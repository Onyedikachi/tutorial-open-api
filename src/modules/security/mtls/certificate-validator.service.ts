import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';

export interface ClientCertIdentity {
  cn?: string;
  organization?: string;
  serialNumber: string;
}

@Injectable()
export class CertificateValidator {
  private readonly logger = new Logger(CertificateValidator.name);
  private readonly caStore: forge.pki.CAStore;

  constructor(private configService: ConfigService) {
    const bundlePath = this.configService.get<string>(
      'MTLS_CA_BUNDLE_PATH',
      path.join(process.cwd(), 'certs', 'ca.crt'),
    );

    this.caStore = forge.pki.createCaStore();
    try {
      const caPem = fs.readFileSync(bundlePath, 'utf8');
      this.caStore.addCertificate(forge.pki.certificateFromPem(caPem));
    } catch (error) {
      // Non-fatal: the mTLS gateway (nginx) already verifies the chain at
      // the TLS layer. This CA store only backs the app's own
      // defense-in-depth re-verification of the forwarded certificate.
      this.logger.warn(
        `Could not load mTLS CA bundle from ${bundlePath} (${error.message}); ` +
          'app-level chain re-verification is disabled, relying on gateway-level verification only.',
      );
    }
  }

  /**
   * Validate a certificate's validity window and, when a CA bundle is
   * loaded, its chain of trust.
   */
  validateCertificate(certPem: string): boolean {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      return this.isWithinValidityWindow(cert) && this.validateChain(cert);
    } catch (error) {
      this.logger.warn(`Certificate validation failed: ${error.message}`);
      return false;
    }
  }

  extractIdentity(certPem: string): ClientCertIdentity {
    const cert = forge.pki.certificateFromPem(certPem);
    return {
      cn: cert.subject.getField('CN')?.value,
      organization: cert.subject.getField('O')?.value,
      serialNumber: cert.serialNumber,
    };
  }

  private isWithinValidityWindow(cert: forge.pki.Certificate): boolean {
    const now = new Date();
    return cert.validity.notBefore <= now && cert.validity.notAfter >= now;
  }

  private validateChain(cert: forge.pki.Certificate): boolean {
    if (this.caStore.listAllCertificates().length === 0) {
      // No local CA bundle loaded - trust the gateway's TLS-layer
      // verification rather than failing closed on missing local config.
      return true;
    }
    try {
      return forge.pki.verifyCertificateChain(this.caStore, [cert]);
    } catch (error) {
      this.logger.warn(`Certificate chain verification failed: ${error.message}`);
      return false;
    }
  }
}

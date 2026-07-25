import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CertificateValidator } from './certificate-validator.service';
import { RegistryService } from '../../registry/registry.service';

/**
 * Verifies the mTLS client-certificate identity for requests that reach
 * the app through the mTLS gateway (nginx/mtls-gateway.conf). That proxy
 * terminates TLS, requires+verifies a client certificate against the CA
 * bundle, and forwards the result via X-SSL-Client-* headers.
 *
 * This middleware does not itself perform TLS termination - the app is
 * plain HTTP behind the proxy - so it MUST only be trusted on a network
 * path where the proxy is the sole entry point. Requests that reach the
 * app directly (e.g. the dev :3000 port used by the browser demo
 * frontend) simply won't carry these headers and will be rejected here.
 */
@Injectable()
export class MTLSMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MTLSMiddleware.name);

  constructor(
    private certValidator: CertificateValidator,
    private registryService: RegistryService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const verify = req.header('x-ssl-client-verify');

    if (verify !== 'SUCCESS') {
      throw new UnauthorizedException('mTLS client certificate required or not verified');
    }

    const escapedCertPem = req.header('x-ssl-client-cert');
    const dn = req.header('x-ssl-client-s-dn');
    const serialFromProxy = req.header('x-ssl-client-serial');

    let cn: string | undefined;
    let organization: string | undefined;
    let serialNumber: string | undefined = serialFromProxy;

    if (escapedCertPem) {
      const certPem = decodeURIComponent(escapedCertPem);

      // Defense-in-depth: re-check validity window / chain locally rather
      // than trusting the proxy's verdict alone.
      if (!this.certValidator.validateCertificate(certPem)) {
        throw new UnauthorizedException('Invalid client certificate');
      }

      const identity = this.certValidator.extractIdentity(certPem);
      cn = identity.cn;
      organization = identity.organization;
      serialNumber = identity.serialNumber;
    } else if (dn) {
      cn = this.parseDnField(dn, 'CN');
      organization = this.parseDnField(dn, 'O');
    }

    if (!cn) {
      throw new UnauthorizedException('Client certificate did not present a subject CN');
    }

    const participant = this.registryService.getParticipant(cn);
    if (!participant) {
      throw new UnauthorizedException(`'${cn}' is not a registered Open Banking participant`);
    }

    if (serialNumber && !this.registryService.validateParticipant(cn, { serialNumber })) {
      this.logger.warn(
        `Certificate serial ${serialNumber} for participant '${cn}' does not match the registry's enrolled certificate`,
      );
      throw new UnauthorizedException('Client certificate is not enrolled for this participant');
    }

    req['client'] = {
      clientId: participant.clientId,
      cn,
      organization,
      serialNumber,
      accessRules: participant.accessRules,
    };

    next();
  }

  private parseDnField(dn: string, field: string): string | undefined {
    // nginx $ssl_client_s_dn is comma-separated ("CN=bank-a,O=bank-a,C=NG")
    // by default; fall back to slash-separated legacy format.
    const parts = dn.includes(',') ? dn.split(',') : dn.split('/');
    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key === field) return value;
    }
    return undefined;
  }
}

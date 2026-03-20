import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';

@Injectable()
export class CertificateValidator {
  validateCertificate(cert: any): boolean {
    try {
      // Convert from node's certificate object to forge certificate
      const forgeCert = forge.pki.certificateFromPem(cert.pem || '');
      
      // Check validity period
      const now = new Date();
      if (forgeCert.validity.notBefore > now || forgeCert.validity.notAfter < now) {
        return false;
      }

      // Check if certificate is revoked (you would check against a CRL or OCSP)
      // This is a simplified example
      
      // Optionally check issuer, subject, extensions, etc.
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async validateCertificateChain(certPem: string, caBundle: string[]): Promise<boolean> {
    // Validate the certificate chain against trusted CAs
    // Implementation would verify signatures and chain
    return true;
  }
}
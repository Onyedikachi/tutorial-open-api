import { Module } from '@nestjs/common';
import { MTLSMiddleware } from './mtls.middleware';
import { CertificateValidator } from './certificate-validator.service';

@Module({
  providers: [CertificateValidator, MTLSMiddleware],
  exports: [MTLSMiddleware, CertificateValidator],
})
export class MTLSModule {}
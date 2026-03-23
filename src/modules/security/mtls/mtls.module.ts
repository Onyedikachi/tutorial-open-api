
// export class MTLSModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer
//       .apply(MTLSMiddleware)
//       .forRoutes('pift/*', 'past/*'); // Apply to sensitive endpoints
//   }
// }

import { Module } from '@nestjs/common';
import { MTLSMiddleware } from './mtls.middleware';
import { CertificateValidator } from './certificate-validator.service';

@Module({
  providers: [CertificateValidator, MTLSMiddleware],
  exports: [MTLSMiddleware, CertificateValidator],
})
export class MTLSModule {}
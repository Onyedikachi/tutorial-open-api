import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MTLSModule } from './mtls/mtls.module';
import { MTLSMiddleware } from './mtls/mtls.middleware';

@Module({
  imports: [MTLSModule],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // TPP-to-ASPSP resource/payment calls (AISP + PISP) must arrive through
    // the mTLS gateway (nginx/mtls-gateway.conf). The user-facing OAuth2
    // authorize/token/consent journey (/auth/*) is intentionally excluded -
    // it's the browser-facing leg a TPP's own frontend drives directly.
    consumer
      .apply(MTLSMiddleware)
      .forRoutes('payments', 'payments/*path', 'gateway', 'gateway/*path', 'past/*path');
  }
}
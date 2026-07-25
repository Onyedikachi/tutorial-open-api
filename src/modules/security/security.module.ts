import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { GatewayTrustModule } from './gateway-trust/gateway-trust.module';
import { GatewayTrustMiddleware } from './gateway-trust/gateway-trust.middleware';

@Module({
  imports: [GatewayTrustModule],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // TPP-to-ASPSP resource/payment calls (AISP + PISP) must arrive through
    // tutorial-open-banking-api-gateway - this backend is not published
    // publicly for these routes. The user-facing OAuth2 authorize/consent
    // journey (/auth/*) is intentionally excluded - it's the browser-facing
    // leg the PSU's browser drives directly against this backend.
    consumer
      .apply(GatewayTrustMiddleware)
      .forRoutes('payments', 'payments/*path', 'past/*path');
  }
}

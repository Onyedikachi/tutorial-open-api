import { Module } from '@nestjs/common';
import { GatewayTrustMiddleware } from './gateway-trust.middleware';
import { InternalSecretGuard } from './internal-secret.guard';

@Module({
  providers: [GatewayTrustMiddleware, InternalSecretGuard],
  exports: [GatewayTrustMiddleware, InternalSecretGuard],
})
export class GatewayTrustModule {}

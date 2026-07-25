import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Guards internal, gateway-only endpoints that aren't proxying a TPP's
 * request (e.g. the gateway looking up a TPP's product entitlements
 * before it has decided whether to admit that TPP at all) - so unlike
 * GatewayTrustMiddleware, this does not expect an X-TPP-Client-Id.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const expected = this.configService.get<string>('INTERNAL_GATEWAY_SECRET');
    if (!expected) {
      throw new UnauthorizedException('INTERNAL_GATEWAY_SECRET unset - refusing internal requests');
    }

    const provided = req.header('x-internal-gateway-secret') ?? '';
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    const valid =
      expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);

    if (!valid) {
      throw new UnauthorizedException('Request did not originate from the API gateway');
    }
    return true;
  }
}

import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * This backend is not internet-facing in v2 - the only caller is
 * tutorial-open-banking-api-gateway, which already did the real work
 * (mTLS termination + cert verification, OAuth2 bearer verification via
 * JWKS, product/entitlement checks, rate limiting) before proxying here.
 *
 * This middleware verifies the request actually came through that gateway
 * (shared secret, fails closed if unconfigured - same pattern as v1's
 * MTLSMiddleware, just one hop further out) and trusts the identity it
 * forwarded rather than re-deriving it.
 */
@Injectable()
export class GatewayTrustMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const expected = this.configService.get<string>('INTERNAL_GATEWAY_SECRET');
    if (!expected) {
      throw new UnauthorizedException(
        'INTERNAL_GATEWAY_SECRET unset - refusing all gateway-routed requests',
      );
    }

    const provided = req.header('x-internal-gateway-secret') ?? '';
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    const valid =
      expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);

    if (!valid) {
      throw new UnauthorizedException('Request did not originate from the API gateway');
    }

    const clientId = req.header('x-tpp-client-id');
    if (!clientId) {
      throw new UnauthorizedException('Gateway did not forward a TPP client identity');
    }

    let accessRules: string[] = [];
    const rulesHeader = req.header('x-tpp-access-rules');
    if (rulesHeader) {
      try {
        accessRules = JSON.parse(rulesHeader);
      } catch {
        throw new UnauthorizedException('Malformed X-TPP-Access-Rules header');
      }
    }

    req['client'] = { clientId, accessRules };
    next();
  }
}

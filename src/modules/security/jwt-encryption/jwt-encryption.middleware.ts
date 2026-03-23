import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtEncryptionService } from './jwt-encryption.service';

@Injectable()
export class JwtEncryptionMiddleware implements NestMiddleware {
  constructor(private jwtEncryptionService: JwtEncryptionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // PIFT and PAST endpoints require encrypted JWT in Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('EncryptedJWT ')) {
      throw new UnauthorizedException('Encrypted JWT required');
    }

    const encryptedToken = authHeader.substring(13); // Remove 'EncryptedJWT '

    try {
      // Decrypt and verify
      const payload = await this.jwtEncryptionService.verifyAndDecryptNestedJWT(encryptedToken);

      // For PIFT endpoints, validate payment claims
      if (req.path.includes('/pift/')) {
        this.jwtEncryptionService.validatePaymentClaims(payload);
      }

      // Attach decrypted payload to request for downstream use
      req['secureJWT'] = payload;
      req['client'] = {
        clientId: payload.client_id,
        scope: payload.scope,
      };

      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid encrypted JWT');
    }
  }
}
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtEncryptionService } from '../../security/jwt-encryption/jwt-encryption.service';

@Injectable()
export class PIFTGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtEncryptionService: JwtEncryptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Check access rules
    const client = request.client;
    if (!client || !client.accessRules?.includes('pift_access')) {
      throw new ForbiddenException('PIFT access not granted');
    }

    // Additional PIFT-specific validations
    const secureJWT = request.secureJWT;
    if (secureJWT) {
      // Verify payment is future-dated
      if (secureJWT.execution_date) {
        const executionDate = new Date(secureJWT.execution_date);
        const now = new Date();
        
        if (executionDate <= now) {
          throw new ForbiddenException('PIFT requires future execution date');
        }
      }
    }

    return true;
  }
}
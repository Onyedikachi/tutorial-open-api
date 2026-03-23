import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as jose from 'node-jose';
import { createPublicKey, createPrivateKey, KeyObject } from 'crypto';
import { ConfigService } from '@nestjs/config';

export interface EncryptedJWTPayload {
  sub: string;
  client_id: string;
  scope: string[];
  payment_id?: string;
  amount?: number;
  currency?: string;
  beneficiary?: any;
  exp: number;
  iat: number;
  jti: string;
}

@Injectable()
export class JwtEncryptionService {
  private keystore: jose.JWK.KeyStore;
  private signingKey: KeyObject;
  private encryptionKey: jose.JWK.Key;

  constructor(private configService: ConfigService) {
    this.initializeKeys();
  }

  private async initializeKeys() {
    // Initialize key store for JWE
    this.keystore = jose.JWK.createKeyStore();
    
    // Load or generate RSA keys for signing (JWS) and encryption (JWE)
    const privateKeyPem = this.configService.get('JWT_PRIVATE_KEY');
    const publicKeyPem = this.configService.get('JWT_PUBLIC_KEY');
    const encryptionKeyPem = this.configService.get('JWT_ENCRYPTION_KEY');

    // For signing (RS256)
    this.signingKey = createPrivateKey(privateKeyPem);
    
    // For encryption (RSA-OAEP)
    await this.keystore.add(encryptionKeyPem, 'pem');
    this.encryptionKey = this.keystore.all()[0];
  }

  /**
   * Create nested JWT: first sign, then encrypt (JWS + JWE)
   * This is the recommended approach for FAPI compliant banks
   */
  async createNestedJWT(payload: Partial<EncryptedJWTPayload>): Promise<string> {
    // 1. Create signed JWT (JWS)
    const signedToken = jwt.sign(
      {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        jti: this.generateJTI(),
      },
      this.signingKey,
      {
        algorithm: 'RS256',
        expiresIn: '5m', // Short expiry for PIFT/PAST
        issuer: this.configService.get('ISSUER_URL'),
        audience: this.configService.get('API_URL'),
      }
    );

    // 2. Encrypt the signed JWT (JWE)
    const encryptedToken = await jose.JWE.createEncrypt(
      {
        format: 'compact',
        contentAlg: 'A256GCM',
        alg: 'RSA-OAEP-256',
      },
      this.encryptionKey
    )
      .update(Buffer.from(signedToken))
      .final();

    return encryptedToken.toString();
  }

  /**
   * Decrypt and verify nested JWT
   */
  async verifyAndDecryptNestedJWT(encryptedToken: string): Promise<EncryptedJWTPayload> {
    try {
      // 1. Decrypt JWE
      const decrypted = await jose.JWE.createDecrypt(this.keystore)
        .decrypt(encryptedToken);

      const signedToken = decrypted.payload.toString();

      // 2. Verify JWS signature
      const publicKey = createPublicKey(this.signingKey);
      const verified = jwt.verify(signedToken, publicKey, {
        algorithms: ['RS256'],
        issuer: this.configService.get('ISSUER_URL'),
        audience: this.configService.get('API_URL'),
      });

      return verified as EncryptedJWTPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid encrypted JWT');
    }
  }

  /**
   * For PIFT endpoints, validate payment-specific claims
   */
  validatePaymentClaims(payload: EncryptedJWTPayload): boolean {
    const required = ['payment_id', 'amount', 'currency', 'beneficiary'];
    
    for (const field of required) {
      if (!payload[field]) {
        throw new UnauthorizedException(`Missing required claim: ${field}`);
      }
    }

    // Validate amount is positive
    if (payload.amount && payload.amount <= 0) {
      throw new UnauthorizedException('Invalid amount');
    }

    // Validate currency (ISO 4217)
    if ( payload.currency && !/^[A-Z]{3}$/.test(payload.currency)) {
      throw new UnauthorizedException('Invalid currency format');
    }

    return true;
  }

  private generateJTI(): string {
    return `jti_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
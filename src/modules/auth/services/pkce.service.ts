import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthorizationCode } from '../entities/authorization-code.entity';
import * as crypto from 'crypto';

@Injectable()
export class PKCEService {
  constructor(
    @InjectRepository(AuthorizationCode)
    private authCodeRepository: Repository<AuthorizationCode>
  ) {}

  /**
   * Generate a random code verifier (RFC 7636 Section 4.1)
   * @returns base64url encoded string (43-128 characters)
   */
  generateCodeVerifier(): string {
    // Generate 32 random bytes -> base64url (43 characters)
    const buffer = crypto.randomBytes(32);
    return this.base64URLEncode(buffer);
  }

  /**
   * Generate code challenge from verifier using S256 method
   * @param verifier code verifier
   * @returns base64url encoded SHA256 hash
   */
  generateCodeChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return this.base64URLEncode(hash);
  }

  /**
   * Verify that the code verifier matches the stored challenge
   * @param code authorization code (to lookup challenge)
   * @param verifier code verifier provided by client
   * @returns true if valid
   * @throws UnauthorizedException if invalid
   */
  async verifyCodeVerifier(code: string, verifier: string): Promise<boolean> {
    const authCode = await this.authCodeRepository.findOne({
      where: { code },
      relations: ['consentRequest'],
    });

    if (!authCode || !authCode.consentRequest?.codeChallenge) {
      throw new UnauthorizedException('Invalid authorization code or challenge missing');
    }

    const storedChallenge = authCode.consentRequest.codeChallenge;
    const method = authCode.consentRequest.codeChallengeMethod || 'S256';

    if (method !== 'S256') {
      throw new UnauthorizedException('Unsupported code challenge method');
    }

    const computedChallenge = this.generateCodeChallenge(verifier);

    if (computedChallenge !== storedChallenge) {
      throw new UnauthorizedException('PKCE verification failed');
    }

    return true;
  }

  /**
   * Validate nonce in ID token (optional but recommended for FAPI)
   * @param nonce nonce sent in authorize request
   * @param idToken decoded ID token
   * @returns true if valid
   */
  validateNonce(nonce: string, idToken: any): boolean {
    if (!nonce || !idToken.nonce) {
      // Nonce is optional, but if present must match
      return true;
    }
    if (idToken.nonce !== nonce) {
      throw new UnauthorizedException('Invalid nonce');
    }
    return true;
  }

  /**
   * Helper: base64url encode buffer (RFC 4648)
   */
  private base64URLEncode(buffer: Buffer): string {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
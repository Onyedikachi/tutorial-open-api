import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

import { AuthorizationCode } from './entities/authorization-code.entity';
import { ConsentRequest } from './entities/consent-request.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ConsentService } from './services/consent.service';
import { ConfigService } from '@nestjs/config';
import { PKCEService } from './services/pkce.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthorizationCode)
    private authCodeRepository: Repository<AuthorizationCode>,
    @InjectRepository(ConsentRequest)
    private consentRepository: Repository<ConsentRequest>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private pkceService: PKCEService,
    private consentService: ConsentService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate an authorization code after user consent.
   */
  async generateAuthorizationCode(consentDTO: { consentId: string; approved: boolean; permissions: string[] }): Promise<string> {
    const consent = await this.consentRepository.findOne({
      where: { id: consentDTO.consentId },
    });

    if (!consent) {
      throw new BadRequestException('Consent request not found');
    }

    if (consent.status !== 'pending') {
      throw new BadRequestException('Consent already processed');
    }

    if (consent.expiresAt < new Date()) {
      throw new BadRequestException('Consent request expired');
    }

    if (!consentDTO.approved) {
      // Mark as denied and return error (will be handled by controller)
      consent.status = 'denied';
      consent.processedAt = new Date();
      await this.consentRepository.save(consent);
      throw new UnauthorizedException('Consent denied by user');
    }

    // Mark consent as approved
    consent.status = 'approved';
    consent.userId = consentDTO.permissions?.[0] ? 'user-placeholder' : consent.userId; // In real scenario, get from session
    consent.processedAt = new Date();
    await this.consentRepository.save(consent);

    // Generate authorization code
    const code = randomBytes(32).toString('hex');
    const authCode = this.authCodeRepository.create({
      code,
      consentRequest: consent,
      clientId: consent.clientId,
      userId: consent.userId,
      scope: consent.scope,
      codeChallenge: consent.codeChallenge,
      codeChallengeMethod: consent.codeChallengeMethod,
      redirectUri: consent.redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await this.authCodeRepository.save(authCode);
    return code;
  }

  /**
   * Exchange authorization code for tokens.
   */
  async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret?: string,
    codeVerifier?: string,
  ): Promise<any> {
    const authCode = await this.authCodeRepository.findOne({
      where: { code },
      relations: ['consentRequest'],
    });

    if (!authCode) {
      throw new UnauthorizedException('Invalid authorization code');
    }

    if (authCode.used) {
      throw new UnauthorizedException('Authorization code already used');
    }

    if (authCode.expiresAt < new Date()) {
      throw new UnauthorizedException('Authorization code expired');
    }

    if (authCode.clientId !== clientId) {
      throw new UnauthorizedException('Client ID mismatch');
    }

    // Validate client secret if it's a confidential client (simplified)
    // In production, check against registry

    // PKCE verification (RFC 7636) - required whenever the authorize
    // request registered a code_challenge.
    if (authCode.codeChallenge) {
      if (!codeVerifier) {
        throw new UnauthorizedException('PKCE code verifier required');
      }
      await this.pkceService.verifyCodeVerifier(code, codeVerifier);
    }

    // Mark code as used
    authCode.used = true;
    await this.authCodeRepository.save(authCode);

    // Generate tokens
    const payload = {
      sub: authCode.userId || 'anonymous',
      client_id: authCode.clientId,
      scope: authCode.scope,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRY', '1h'),
    });

    const refreshToken = await this.issueRefreshToken(authCode.clientId, authCode.userId, authCode.scope);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: authCode.scope.join(' '),
    };
  }

  /**
   * Refresh access token. Validates and rotates the refresh token.
   */
  async refreshToken(refreshToken: string): Promise<any> {
    const stored = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
    });

    if (!stored || stored.revoked) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    stored.revoked = true;
    await this.refreshTokenRepository.save(stored);

    const payload = {
      sub: stored.userId || 'anonymous',
      client_id: stored.clientId,
      scope: stored.scope,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRY', '1h'),
    });

    const newRefreshToken = await this.issueRefreshToken(stored.clientId, stored.userId, stored.scope);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: stored.scope.join(' '),
    };
  }

  private async issueRefreshToken(clientId: string, userId: string, scope: string[]): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        token,
        clientId,
        userId,
        scope,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      }),
    );
    return token;
  }

  /**
   * Validate OAuth user profile from third-party provider (if used).
   */
  async validateOAuthUser(profile: any): Promise<any> {
    // This would map the profile to your user database
    // For now, return a dummy user
    return {
      sub: profile.id || 'oauth-user',
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
    };
  }

  /**
   * Validate client credentials (client_id and client_secret) against registry.
   */
  async validateClient(clientId: string, clientSecret: string): Promise<boolean> {
    // In production, fetch from Open Banking Registry or local database
    // Simplified: accept any non-empty secret
    return !!clientId && !!clientSecret;
  }
}
import { Controller, Get, Post, Req, Res, Body, Query, UnauthorizedException } from '@nestjs/common';

import { ConsentService } from './services/consent.service';
import { ConsentDTO } from './dto/consent.dto';
import { TokenRequestDTO } from './dto/token-request.dto';
import { AuthService } from './auth.service';
import { PKCEService } from './services/pkce.service';
import { ProblemDetailsException } from '../../common/exceptions/problem-details.exception';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private consentService: ConsentService,
    private pkceService: PKCEService
  ) {}

  @Get('authorize')
  async authorize(@Req() req, @Res() res) {
    const { 
      client_id, 
      redirect_uri, 
      response_type, 
      scope, 
      state,
      code_challenge,
      code_challenge_method,
      nonce 
    } = req.query;

    if (response_type !== 'code') {
      throw new ProblemDetailsException({
        type: 'https://api.openbanking.ng/errors/invalid-response-type',
        title: 'Invalid Response Type',
        status: 400,
        detail: 'Only response_type=code is supported',
        instance: req.path,
      });
    }

    // Validate PKCE parameters for confidential clients
    if (response_type === 'code' && !code_challenge) {
       throw new ProblemDetailsException({
        type: 'https://api.openbanking.ng/errors/missing-pkce',
        title: 'PKCE Required',
        status: 400,
        detail: 'code_challenge required',
        instance: req.path,
      });
    }

    // Validate code challenge method (only S256 allowed for FAPI compliance)
    if (code_challenge_method && code_challenge_method !== 'S256') {
      throw new ProblemDetailsException({
        type: 'https://api.openbanking.ng/errors/unsupported-pkce-method',
        title: 'Unsupported PKCE Method',
        status: 400,
        detail: 'Only S256 is supported',
        instance: req.path,
      });
    }

    // Create consent request with PKCE data
    const consentRequest = await this.consentService.createConsentRequest({
      clientId: client_id,
      scope,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method || 'S256',
      nonce,
      state
    });

    return res.redirect(`${process.env.CONSENT_UI_URL}/consent/${consentRequest.id}`);
  }

  @Post('token')
  async token(@Body() tokenRequest: TokenRequestDTO,  @Req() req) {
    const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = tokenRequest;

    switch(grant_type) {
      case 'authorization_code':
        // Verify PKCE code verifier
        await this.pkceService.verifyCodeVerifier(code ?? '', code_verifier ?? '');
        
        return this.authService.exchangeCodeForToken(
          code ?? '', 
          client_id ?? '', 
          client_secret,
          code_verifier
        );
      
      case 'refresh_token':
        return this.authService.refreshToken(tokenRequest.refresh_token ?? '');
      
      default:
        throw new ProblemDetailsException({
          type: 'https://api.openbanking.ng/errors/unsupported-grant-type',
          title: 'Unsupported Grant Type',
          status: 400,
          detail: `Grant type ${grant_type} not supported`,
          instance: req.path,
        });
    }
  }

  @Get('.well-known/openid-configuration')
  async getOpenIDConfig() {
    return {
      issuer: process.env.ISSUER_URL,
      authorization_endpoint: `${process.env.API_URL}/auth/authorize`,
      token_endpoint: `${process.env.API_URL}/auth/token`,
      userinfo_endpoint: `${process.env.API_URL}/auth/userinfo`,
      jwks_uri: `${process.env.API_URL}/auth/jwks`,
      response_types_supported: ['code'],
      response_modes_supported: ['query', 'fragment'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'private_key_jwt'],
      claims_supported: ['sub', 'name', 'email', 'phone'],
      code_challenge_methods_supported: ['S256'],
    };
  }
}
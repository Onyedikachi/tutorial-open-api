import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jose from 'node-jose';

@Injectable()
export class JwksService implements OnModuleInit {
  private jwks: { keys: any[] };

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const publicKeyPem = this.configService.get<string>('JWT_PUBLIC_KEY');
    const keystore = jose.JWK.createKeyStore();
    const key = await keystore.add(publicKeyPem, 'pem', { use: 'sig', alg: 'RS256' });
    this.jwks = { keys: [key.toJSON()] };
  }

  getJwks() {
    return this.jwks;
  }
}

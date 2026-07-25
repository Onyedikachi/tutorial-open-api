import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { JwksController } from './jwks.controller';
import { ConsentUiController } from './consent-ui.controller';
import { OAuth2Strategy } from './strategies/oauth2.strategy';
import { ConsentService } from './services/consent.service';
import { AuthService } from './auth.service';
import { JwksService } from './services/jwks.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthorizationCode } from './entities/authorization-code.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentRequest } from './entities/consent-request.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PKCEService } from './services/pkce.service';
import { RegistryService } from '../registry/registry.service';
import { HttpModule, HttpService } from '@nestjs/axios';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'oauth2' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        // RS256, not a shared secret: lets tutorial-open-banking-api-gateway
        // verify access tokens itself via GET /auth/jwks, independent of
        // this backend, the way a real API gateway product would.
        privateKey: configService.get<string>('JWT_PRIVATE_KEY'),
        publicKey: configService.get<string>('JWT_PUBLIC_KEY'),
        signOptions: { algorithm: 'RS256', expiresIn: '1h' },
        verifyOptions: { algorithms: ['RS256'] },
      }),
      inject: [ConfigService],
    }),
    HttpModule.register({ timeout: 10000 }),
    TypeOrmModule.forFeature([AuthorizationCode, ConsentRequest, RefreshToken]),
  ],
  controllers: [AuthController, JwksController, ConsentUiController],
  providers: [
    AuthService, OAuth2Strategy, ConsentService,
    PKCEService, ConfigService, RegistryService, JwksService,
  ],
  exports: [AuthService, HttpModule],
})
export class AuthModule {}
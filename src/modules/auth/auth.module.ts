import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { OAuth2Strategy } from './strategies/oauth2.strategy';
import { ConsentService } from './services/consent.service';
import { AuthService } from './auth.service';
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
    // JwtModule.register({
    //   secret: process.env.JWT_SECRET,
    //   signOptions: { expiresIn: '1h' },
    // }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
    HttpModule.register({ timeout: 10000 }),
    TypeOrmModule.forFeature([AuthorizationCode, ConsentRequest, RefreshToken]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, OAuth2Strategy, ConsentService, 
    PKCEService, ConfigService, RegistryService
  ],
  exports: [AuthService, HttpModule],
})
export class AuthModule {}
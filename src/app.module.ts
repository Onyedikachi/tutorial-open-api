import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

import { AuthModule } from './modules/auth/auth.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RegistryModule } from './modules/registry/registry.module';
import { SecurityModule } from './modules/security/security.module';
import { EventsModule } from './modules/events/events.module';
import { CommonModule } from './common/common.module';

import rabbitmqConfig from './config/rabbitmq.config';
import { SagaModule } from './modules/saga/saga.module';
import { JwtEncryptionModule } from './modules/security/jwt-encryption/jwt-encryption.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [rabbitmqConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        ttl: configService.get('REDIS_TTL', 86400),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    GatewayModule,
    PaymentsModule,
    RegistryModule,
    SecurityModule,
    EventsModule,
    CommonModule,
    SagaModule,
    JwtEncryptionModule,
  ],
})
export class AppModule {}
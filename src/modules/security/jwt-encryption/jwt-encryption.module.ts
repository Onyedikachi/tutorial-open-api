import { Module, Global } from '@nestjs/common';
import { JwtEncryptionService } from './jwt-encryption.service';
import { JwtEncryptionMiddleware } from './jwt-encryption.middleware';

@Global()
@Module({
  providers: [JwtEncryptionService, JwtEncryptionMiddleware],
  exports: [JwtEncryptionService, JwtEncryptionMiddleware],
})
export class JwtEncryptionModule {}
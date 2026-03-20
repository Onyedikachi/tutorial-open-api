import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MTLSModule } from './mtls/mtls.module';

@Module({
  imports: [MTLSModule],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply mTLS middleware to specific routes if needed
  }
}
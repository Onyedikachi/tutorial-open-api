import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RegistryService } from './registry.service';
import { RegistryController } from './registry.controller';
import { GatewayTrustModule } from '../security/gateway-trust/gateway-trust.module';

@Global()
@Module({
  imports: [HttpModule, GatewayTrustModule],
  controllers: [RegistryController],
  providers: [RegistryService],
  exports: [RegistryService],
})
export class RegistryModule {}
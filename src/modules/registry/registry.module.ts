import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RegistryService } from './registry.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [RegistryService],
  exports: [RegistryService],
})
export class RegistryModule {}
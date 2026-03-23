import { Module } from '@nestjs/common';

import { AccessRuleGuard } from './guards/access-rule.guard';
import { PISTGuard } from './guards/pist.guard';
import { MISTGuard } from './guards/mit.guard';
import { PIFTGuard } from './guards/pift.guard';
import { PASTGuard } from './guards/past.guard';

import { PISTService } from './services/pist.service';
import { MISTService } from './services/mit.service';
import { PIFTService } from './services/pift.service';
import { PASTService } from './services/past.service';
import { GatewayController } from './gateway.controller';

@Module({
  controllers: [GatewayController],
  providers: [
    AccessRuleGuard,
    PISTGuard,
    MISTGuard,
    PIFTGuard,
    PASTGuard,
    PISTService,
    MISTService,
    PIFTService,
    PASTService,
  ],
  exports: [PISTGuard, MISTGuard, PIFTGuard, PASTGuard],
})
export class GatewayModule {}
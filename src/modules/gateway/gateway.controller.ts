import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PISTGuard } from './guards/pist.guard';
import { MISTGuard } from './guards/mit.guard';
import { PIFTGuard } from './guards/pift.guard';
import { PASTGuard } from './guards/past.guard';

@Controller('gateway')
export class GatewayController {
  @Get('pist/status')
  @UseGuards(PISTGuard)
  getPISTStatus() {
    return { message: 'PIST access granted' };
  }

  @Post('mit/initiate')
  @UseGuards(MISTGuard)
  initiateMIT() {
    return { message: 'MIT initiated' };
  }

  @Post('pift/schedule')
  @UseGuards(PIFTGuard)
  schedulePIFT() {
    return { message: 'PIFT scheduled' };
  }

  @Get('past/statements')
  @UseGuards(PASTGuard)
  getPASTStatements() {
    return { message: 'PAST statements retrieved' };
  }
}
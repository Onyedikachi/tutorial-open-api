import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { RegistryService } from './registry.service';
import { InternalSecretGuard } from '../security/gateway-trust/internal-secret.guard';

/**
 * Internal-only: called by tutorial-open-banking-api-gateway to resolve a
 * TPP's product entitlements (accessRules) before proxying its request.
 * Never part of the published openbanking.yml contract - a real bank
 * would never expose its registry directly to TPPs either.
 */
@Controller('internal/registry')
@UseGuards(InternalSecretGuard)
export class RegistryController {
  constructor(private registryService: RegistryService) {}

  @Get('participants/:clientId')
  getParticipant(@Param('clientId') clientId: string) {
    const participant = this.registryService.getParticipant(clientId);
    if (!participant) {
      throw new NotFoundException(`No registered participant '${clientId}'`);
    }
    return {
      clientId: participant.clientId,
      name: participant.name,
      accessRules: participant.accessRules,
    };
  }
}

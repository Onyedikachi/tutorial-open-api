import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class RegistryService implements OnModuleInit {
  private participants: Map<string, any> = new Map();

  constructor(private httpService: HttpService) {}

  async onModuleInit() {
    // Fetch participants metadata on startup
    await this.syncParticipants();
    
    // Schedule periodic sync
    setInterval(() => this.syncParticipants(), 3600000); // Every hour
  }

  async syncParticipants(): Promise<void> {
    try {
      const response = await lastValueFrom(
        this.httpService.get(process.env.OPEN_BANKING_REGISTRY_URL ?? '')
      );
      
      response.data.participants.forEach(participant => {
        this.participants.set(participant.clientId, participant);
      });
    } catch (error) {
      console.error('Failed to sync registry:', error);
    }
  }

  getParticipant(clientId: string): any {
    return this.participants.get(clientId);
  }

  validateParticipant(clientId: string, certificate: any): boolean {
    const participant = this.getParticipant(clientId);
    if (!participant) return false;

    // Validate certificate against registry
    return participant.certificates.some(cert => 
      cert.serialNumber === certificate.serialNumber
    );
  }
}
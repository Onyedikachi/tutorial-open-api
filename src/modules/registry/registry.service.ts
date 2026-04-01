import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

interface Certificate {
  serialNumber: string;
}

interface Participant {
  clientId: string;
  name: string;
  certificates: Certificate[];
}

@Injectable()
export class RegistryService implements OnModuleInit {
  private participants: Map<string, Participant> = new Map();

  constructor(private httpService: HttpService) {}

  async onModuleInit() {
    // Load mock first (safe fallback)
    this.loadMockParticipants();

    // Try live sync (optional)
    await this.syncParticipants();

    // Optional: periodic refresh
    setInterval(() => this.syncParticipants(), 3600000);
  }

  // ✅ Mock data (used for dev/test or fallback)
  private loadMockParticipants() {
    const mockParticipants: Participant[] = [
      {
        clientId: 'bank-a',
        name: 'Bank A',
        certificates: [{ serialNumber: 'ABC123' }],
      },
      {
        clientId: 'fintech-x',
        name: 'Fintech X',
        certificates: [{ serialNumber: 'XYZ789' }],
      },
    ];

    mockParticipants.forEach((p) => {
      this.participants.set(p.clientId, p);
    });
  }

  // Sync from Open Banking registry
  async syncParticipants(): Promise<void> {
    const url = process.env.OPEN_BANKING_REGISTRY_URL;

    if (!url) return; // skip if not configured

    try {
      const response = await lastValueFrom(
        this.httpService.get(url),
      );

      const participants: Participant[] = response.data.participants || [];

      participants.forEach((participant) => {
        this.participants.set(participant.clientId, participant);
      });

    } catch (error) {
      console.error('Failed to sync registry, using cached/mock data:', error.message);
    }
  }

  // Get participant
  getParticipant(clientId: string): Participant | undefined {
    return this.participants.get(clientId);
  }

  //  Validate participant certificate
  validateParticipant(clientId: string, certificate: Certificate): boolean {
    const participant = this.getParticipant(clientId);
    if (!participant) return false;

    return participant.certificates.some(
      (cert) => cert.serialNumber === certificate.serialNumber,
    );
  }
}
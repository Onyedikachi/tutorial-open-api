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
  // CBN Open Banking Nigeria access-rule categories ("products" in API
  // gateway terms) this TPP has been approved for (PIST/PIFT/MIT/PAST).
  // Enforced by tutorial-open-banking-api-gateway, which calls
  // GET /internal/registry/participants/:clientId (registry.controller.ts)
  // to resolve this before proxying a request.
  accessRules: string[];
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

  // Mock data (used for dev/test or fallback)
  private loadMockParticipants() {
    // certificates are left empty here: in production these are enrolled
    // via syncParticipants() from the live Open Banking Registry directory.
    // For local dev, client certs are minted by
    // tutorial-open-banking-api-gateway/certs/generate-dev-certs.sh - the
    // cert's CN must match a clientId here for the gateway to admit it.
    const mockParticipants: Participant[] = [
      {
        clientId: 'bank-a',
        name: 'Bank A',
        certificates: [],
        accessRules: ['accounts_read', 'pist_access', 'pift_access', 'mit_access', 'past_access'],
      },
      {
        clientId: 'fintech-x',
        name: 'Fintech X',
        certificates: [],
        accessRules: ['accounts_read', 'pist_access'],
      },
      {
        // The demo TPP behind tutorial-open-banking-client-backend.
        clientId: 'acme-fintech',
        name: 'Acme Fintech',
        certificates: [],
        accessRules: ['accounts_read', 'pist_access', 'pift_access', 'past_access'],
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

  // Validate participant certificate against the serials enrolled for
  // them in the registry. Enrollment is best-effort: a participant with
  // no enrolled certificates yet is treated as identified-but-unpinned
  // (their mTLS client cert's CN was already verified against the trusted
  // CA by tutorial-open-banking-api-gateway) rather than rejected, since
  // certificate rotation in a real Open Banking directory lags issuance.
  // Callers that need strict pinning should check
  // `certificates.length > 0` themselves.
  validateParticipant(clientId: string, certificate: Certificate): boolean {
    const participant = this.getParticipant(clientId);

    if (!participant) return false;
    if (participant.certificates.length === 0) return true;

    return participant.certificates.some(
      (cert) => cert.serialNumber === certificate.serialNumber,
    );
  }
}
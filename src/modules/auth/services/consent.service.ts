import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsentRequest } from '../entities/consent-request.entity';
import { AuditLogger } from '../../../common/services/audit-logger.service';
import { RegistryService } from 'src/modules/registry/registry.service';

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(ConsentRequest)
    private consentRepository: Repository<ConsentRequest>,
    private auditLogger: AuditLogger,
    private registryService: RegistryService
  ) {}

  async createConsentRequest(data: {
    clientId: string;
    redirectUri: string;
    scope: string[];
    codeChallenge: string;
    codeChallengeMethod: string;
    nonce?: string;
    state?: string;
    accounts?: string[];
  }): Promise<ConsentRequest> {
    const consentRequest = this.consentRepository.create({
      clientId: data.clientId,
      scope: data.scope,
      redirectUri: data.redirectUri,
      accounts: data?.accounts,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes expiry
    });

    // Log consent creation for audit
    await this.auditLogger.log({
      action: 'CONSENT_REQUEST_CREATED',
      clientId: data.clientId,
      timestamp: new Date(),
      details: { scope: data.scope },
    });

    return this.consentRepository.save(consentRequest);
  }

  async processConsent(
    consentId: string,
    userId: string,
    approved: boolean,
  ): Promise<void> {
    const consent = await this.consentRepository.findOne({
      where: { id: consentId },
    });

    if (!consent) {
      throw new Error('Consent request not found');
    }

    if (consent.expiresAt < new Date()) {
      throw new Error('Consent request expired');
    }

    consent.status = approved ? 'approved' : 'denied';
    consent.userId = userId;
    consent.processedAt = new Date();

    await this.consentRepository.save(consent);

    // Audit log for consent decision
    await this.auditLogger.log({
      action: approved ? 'CONSENT_APPROVED' : 'CONSENT_DENIED',
      userId,
      clientId: consent.clientId,
      timestamp: new Date(),
      details: { scope: consent.scope, consentId },
    });
  }
  async getConsentDetails(consentId: string): Promise<any> {
    const consent = await this.consentRepository.findOne({
      where: { id: consentId },
    });
    if (!consent) {
      throw new NotFoundException('Consent not found');
    }

    const participant = this.registryService.getParticipant(consent.clientId);
    const clientName = participant?.name || consent.clientId;

    const permissions = this.mapScopesToPermissions(consent.scope);

    return {
      id: consent.id,
      clientName,
      permissions,
      expiresAt: consent.expiresAt,
      redirectUri: consent.redirectUri,
      status: consent.status,
    };
  }

  private mapScopesToPermissions(scopes: string[]): any[] {
    const map: Record<
      string,
      { type: string; description: string; required: boolean }
    > = {
      accounts_read: {
        type: 'accounts_read',
        description: 'Read your account information and balances',
        required: true,
      },
      payments_initiate: {
        type: 'payments_initiate',
        description: 'Initiate payments from your accounts',
        required: false,
      },
      // add other scopes as needed
    };
    return scopes.map(
      (scope) =>
        map[scope] || {
          type: scope,
          description: `Access to ${scope}`,
          required: false,
        },
    );
  }
}

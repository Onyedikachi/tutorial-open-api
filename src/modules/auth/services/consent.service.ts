import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsentRequest } from '../entities/consent-request.entity';
import { AuditLogger } from '../../../common/services/audit-logger.service';

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(ConsentRequest)
    private consentRepository: Repository<ConsentRequest>,
    private auditLogger: AuditLogger
  ) {}

  async createConsentRequest(data: {
    clientId: string;
    redirectUri: string;
    scope: string[];
    codeChallenge: string;
    codeChallengeMethod: string;
    nonce?: string;
    state?: string;
  }): Promise<ConsentRequest> {
    const consentRequest = this.consentRepository.create({
      clientId: data.clientId,
      scope: data.scope,
      redirectUri: data.redirectUri,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes expiry
    });

    // Log consent creation for audit
    await this.auditLogger.log({
      action: 'CONSENT_REQUEST_CREATED',
      clientId: data.clientId,
      timestamp: new Date(),
      details: { scope: data.scope }
    });

    return this.consentRepository.save(consentRequest);
  }

  async processConsent(consentId: string, userId: string, approved: boolean): Promise<void> {
    const consent = await this.consentRepository.findOne({ where: { id: consentId } });
    
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
      details: { scope: consent.scope, consentId }
    });
  }
}
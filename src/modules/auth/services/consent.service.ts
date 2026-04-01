import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsentRequest } from '../entities/consent-request.entity';
import { AuditLogger } from '../../../common/services/audit-logger.service';
import { RegistryService } from 'src/modules/registry/registry.service';
import { randomBytes } from 'crypto';
import { AuthorizationCode } from '../entities/authorization-code.entity';

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(ConsentRequest)
    private consentRepository: Repository<ConsentRequest>,
    @InjectRepository(AuthorizationCode)
    private authCodeRepository: Repository<AuthorizationCode>, 
    private auditLogger: AuditLogger,
    private registryService: RegistryService,
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
    approved: boolean,
    permissions: string[],
    accounts: string[] | undefined,
    userId: string,
  ): Promise<string | null> {
    const consent = await this.consentRepository.findOne({
      where: { id: consentId },
    });
    if (!consent) {
      throw new NotFoundException('Consent not found');
    }
    if (consent.status !== 'pending') {
      throw new BadRequestException('Consent already processed');
    }
    if (consent.expiresAt < new Date()) {
      throw new BadRequestException('Consent expired');
    }

    // If approved, store the final scope (only the permissions the user approved)
    if (approved) {
      // Map permissions back to scopes (permissions are already in scope format, e.g., "accounts_read")
      const approvedScopes = permissions;
      consent.scope = approvedScopes;
      consent.userId = userId;
      consent.processedAt = new Date();
      consent.status = 'approved';
      if (accounts && accounts.length) {
        consent.accounts = accounts;
      }
      await this.consentRepository.save(consent);

      // Generate authorization code
      const code = randomBytes(32).toString('hex');
      const authCode = this.authCodeRepository.create({
        code,
        consentRequest: consent,
        clientId: consent.clientId,
        userId,
        scope: consent.scope,
        codeChallenge: consent.codeChallenge,
        codeChallengeMethod: consent.codeChallengeMethod,
        redirectUri: consent.redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });
      await this.authCodeRepository.save(authCode);

      // Log audit
      await this.auditLogger.log({
        action: 'CONSENT_APPROVED',
        userId,
        clientId: consent.clientId,
        timestamp: new Date(),
        details: { scope: consent.scope, consentId, accounts },
      });

      return code;
    } else {
      // Denied
      consent.status = 'denied';
      consent.userId = userId;
      consent.processedAt = new Date();
      await this.consentRepository.save(consent);

      await this.auditLogger.log({
        action: 'CONSENT_DENIED',
        userId,
        clientId: consent.clientId,
        timestamp: new Date(),
        details: { consentId },
      });

      return null;
    }
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
      scope: consent.scope,
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

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentRequest } from '../../auth/entities/consent-request.entity';

@Injectable()
export class AccountConsentGuard implements CanActivate {
  constructor(
    @InjectRepository(ConsentRequest)
    private consentRepo: Repository<ConsentRequest>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const consentId = request.headers['x-consent-id'];
    const accountId = request.params.accountId;

    if (!consentId) {
      throw new ForbiddenException('Consent ID is required');
    }

    const consent = await this.consentRepo.findOne({
      where: { id: consentId, status: 'approved' },
    });

    if (!consent) {
      throw new ForbiddenException('Invalid or expired consent');
    }

    // Check if consent includes account access scope
    if (!consent.scope.includes('accounts_read')) {
      throw new ForbiddenException('Consent does not include account access');
    }

    // Check if the account is among the approved accounts
    if (consent.accounts && !consent.accounts.includes(accountId)) {
      throw new ForbiddenException('Account not authorized in consent');
    }

    // Attach consent to request for later use
    request.consent = consent;
    return true;
  }
}
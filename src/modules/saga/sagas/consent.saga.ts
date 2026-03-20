import { Injectable } from '@nestjs/common';
import { SagaOrchestrator } from '../saga.orchestrator';
import { EntityManager } from 'typeorm';

export interface ConsentSagaContext {
  consentId: string;
  clientId: string;
  userId: string;
  scope: string[];
  accounts: string[];
}

@Injectable()
export class ConsentSaga {
  constructor(private sagaOrchestrator: SagaOrchestrator) {
    // Register consent-specific step handlers
    this.sagaOrchestrator.registerStepHandler('create_consent_record', new CreateConsentRecordHandler());
    this.sagaOrchestrator.registerStepHandler('store_consent_in_registry', new StoreConsentInRegistryHandler());
    this.sagaOrchestrator.registerStepHandler('notify_account_holders', new NotifyAccountHoldersHandler());
  }

  async createConsent(
    context: ConsentSagaContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<string> {
    const steps = [
      {
        name: 'create_consent_record',
        order: 1,
        data: {
          consentId: context.consentId,
          clientId: context.clientId,
          userId: context.userId,
          scope: context.scope,
        },
        compensationData: {
          consentId: context.consentId,
        },
      },
      {
        name: 'store_consent_in_registry',
        order: 2,
        data: {
          consentId: context.consentId,
          clientId: context.clientId,
          scope: context.scope,
          accounts: context.accounts,
        },
        compensationData: {
          consentId: context.consentId,
        },
      },
      {
        name: 'notify_account_holders',
        order: 3,
        data: {
          consentId: context.consentId,
          accounts: context.accounts,
        },
        compensationData: {
          consentId: context.consentId,
        },
      },
    ];

    return this.sagaOrchestrator.startSaga(
      'CONSENT',
      context.consentId,
      context,
      steps,
      transactionalEntityManager,
    );
  }
}

// Step handlers implementation...
class CreateConsentRecordHandler implements SagaStepHandler {
  async execute(stepData: any): Promise<any> {
    // Create consent record in database
    return { status: 'CREATED' };
  }

  async compensate(compensationData: any): Promise<void> {
    // Delete consent record
  }
}

class StoreConsentInRegistryHandler implements SagaStepHandler {
  async execute(stepData: any): Promise<any> {
    // Store consent in Open Banking Registry
    return { status: 'STORED' };
  }

  async compensate(compensationData: any): Promise<void> {
    // Remove consent from registry
  }
}

class NotifyAccountHoldersHandler implements SagaStepHandler {
  async execute(stepData: any): Promise<any> {
    // Notify account holders about new consent
    return { status: 'NOTIFIED' };
  }

  async compensate(compensationData: any): Promise<void> {
    // Send revocation notification
  }
}
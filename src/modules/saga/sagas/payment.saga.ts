import { Injectable, Logger } from '@nestjs/common';
import { SagaOrchestrator, SagaStepHandler } from '../saga.orchestrator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { EventProducer } from '../../events/producers/event.producer';
import { PaymentEventProducer } from '../../events/producers/payment-event.producer';

export interface PaymentSagaContext {
  paymentId: string;
  amount: number;
  currency: string;
  debtorAccount: string;
  creditorAccount: string;
  description: string;
}

@Injectable()
export class PaymentSaga {
  private readonly logger = new Logger(PaymentSaga.name);

  constructor(
    private sagaOrchestrator: SagaOrchestrator,
    private paymentEventProducer: PaymentEventProducer,
  ) {
    // Register step handlers
    this.sagaOrchestrator.registerStepHandler('debit_account', new DebitAccountHandler());
    this.sagaOrchestrator.registerStepHandler('credit_account', new CreditAccountHandler());
    this.sagaOrchestrator.registerStepHandler('update_ledger', new UpdateLedgerHandler());
    this.sagaOrchestrator.registerStepHandler('send_notification', new SendNotificationHandler());
  }

  async initiatePayment(
    context: PaymentSagaContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<string> {
    const steps = [
      {
        name: 'debit_account',
        order: 1,
        data: {
          account: context.debtorAccount,
          amount: context.amount,
          currency: context.currency,
          reference: `DEBIT_${context.paymentId}`,
        },
        compensationData: {
          account: context.debtorAccount,
          amount: context.amount,
          currency: context.currency,
          reference: `REVERSE_DEBIT_${context.paymentId}`,
        },
      },
      {
        name: 'credit_account',
        order: 2,
        data: {
          account: context.creditorAccount,
          amount: context.amount,
          currency: context.currency,
          reference: `CREDIT_${context.paymentId}`,
        },
        compensationData: {
          account: context.creditorAccount,
          amount: context.amount,
          currency: context.currency,
          reference: `REVERSE_CREDIT_${context.paymentId}`,
        },
      },
      {
        name: 'update_ledger',
        order: 3,
        data: {
          paymentId: context.paymentId,
          amount: context.amount,
          currency: context.currency,
        },
        compensationData: {
          paymentId: context.paymentId,
        },
      },
      {
        name: 'send_notification',
        order: 4,
        data: {
          paymentId: context.paymentId,
          amount: context.amount,
          currency: context.currency,
          type: 'PAYMENT_SUCCESS',
        },
        compensationData: {
          paymentId: context.paymentId,
          type: 'PAYMENT_FAILED',
        },
      },
    ];

    const sagaId = await this.sagaOrchestrator.startSaga(
      'PAYMENT',
      context.paymentId,
      context,
      steps,
      transactionalEntityManager,
    );

    await this.paymentEventProducer.emitPaymentInitiated({
      paymentId: context.paymentId,
      amount: context.amount,
      currency: context.currency,
      sagaId,
    });

    return sagaId;
  }
}

// Step Handlers
class DebitAccountHandler implements SagaStepHandler {
  private readonly logger = new Logger(DebitAccountHandler.name);

  async execute(stepData: any): Promise<any> {
    this.logger.log(`Debiting account: ${stepData.account}`);
    
    // Simulate account debit logic
    // In production, call core banking system
    return {
      transactionId: `TXN_${Date.now()}`,
      status: 'SUCCESS',
      balance: 1000 - stepData.amount,
    };
  }

  async compensate(compensationData: any): Promise<void> {
    this.logger.log(`Reversing debit: ${compensationData.account}`);
    // Reverse the debit transaction
  }
}

class CreditAccountHandler implements SagaStepHandler {
  private readonly logger = new Logger(CreditAccountHandler.name);

  async execute(stepData: any): Promise<any> {
    this.logger.log(`Crediting account: ${stepData.account}`);
    
    // Simulate account credit logic
    return {
      transactionId: `TXN_${Date.now()}`,
      status: 'SUCCESS',
      balance: 2000 + stepData.amount,
    };
  }

  async compensate(compensationData: any): Promise<void> {
    this.logger.log(`Reversing credit: ${compensationData.account}`);
    // Reverse the credit transaction
  }
}

class UpdateLedgerHandler implements SagaStepHandler {
  private readonly logger = new Logger(UpdateLedgerHandler.name);

  async execute(stepData: any): Promise<any> {
    this.logger.log(`Updating ledger for payment: ${stepData.paymentId}`);
    
    // Update general ledger
    return {
      ledgerId: `LEDGER_${Date.now()}`,
      entries: [
        { account: 'DEBTOR', amount: -stepData.amount },
        { account: 'CREDITOR', amount: stepData.amount },
      ],
    };
  }

  async compensate(compensationData: any): Promise<void> {
    this.logger.log(`Reversing ledger entries: ${compensationData.paymentId}`);
    // Reverse ledger entries
  }
}

class SendNotificationHandler implements SagaStepHandler {
  private readonly logger = new Logger(SendNotificationHandler.name);

  async execute(stepData: any): Promise<any> {
    this.logger.log(`Sending notification for payment: ${stepData.paymentId}`);
    
    // Send SMS/email/push notification
    return {
      notificationId: `NOTIF_${Date.now()}`,
      status: 'SENT',
    };
  }

  async compensate(compensationData: any): Promise<void> {
    this.logger.log(`Sending failure notification: ${compensationData.paymentId}`);
    // Send failure notification
  }
}
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

export enum EventType {
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_PROCESSING = 'payment.processing',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REVERSED = 'payment.reversed',
  
  CONSENT_CREATED = 'consent.created',
  CONSENT_APPROVED = 'consent.approved',
  CONSENT_REVOKED = 'consent.revoked',
  
  AUDIT_LOG = 'audit.log',
  NOTIFICATION_SENT = 'notification.sent',
  COMPLIANCE_ALERT = 'compliance.alert',

    // Saga events
  SAGA_STARTED = 'saga.started',
  SAGA_STEP_COMPLETED = 'saga.step.completed',
  SAGA_COMPLETED = 'saga.completed',
  SAGA_FAILED = 'saga.failed',
  SAGA_COMPENSATION_FAILED = 'saga.compensation.failed',

}

@Injectable()
export class EventProducer {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy
  ) {}

  async emit(eventType: EventType, data: any, priority: number = 5): Promise<void> {
    const event = {
      type: eventType,
      data: {
        ...data,
        eventId: this.generateEventId(),
        timestamp: new Date().toISOString(),
        version: '1.0'
      },
      metadata: {
        priority,
        source: 'openbanking-api',
        environment: process.env.NODE_ENV
      }
    };

    // Publish to exchange with routing key based on event type
    await lastValueFrom(
      this.client.emit(eventType, event)
    );
  }

  async emitPaymentInitiated(paymentData: any): Promise<void> {
    await this.emit(EventType.PAYMENT_INITIATED, {
      paymentId: paymentData.paymentId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      debtor: paymentData.debtor,
      creditor: paymentData.creditor,
      idempotencyKey: paymentData.idempotencyKey,
      sagaId: paymentData?.sagaId
    }, 8); // High priority
  }

  async emitPaymentCompleted(paymentData: any): Promise<void> {
    await this.emit(EventType.PAYMENT_COMPLETED, {
      paymentId: paymentData.paymentId,
      settlementDate: new Date(),
      transactionReference: paymentData.transactionReference,
      finalAmount: paymentData.amount
    }, 9); // Highest priority
  }

  async emitConsentEvent(consentData: any): Promise<void> {
    const eventType = consentData.status === 'approved' 
      ? EventType.CONSENT_APPROVED 
      : EventType.CONSENT_CREATED;

    await this.emit(eventType, {
      consentId: consentData.id,
      clientId: consentData.clientId,
      userId: consentData.userId,
      scope: consentData.scope,
      expiresAt: consentData.expiresAt
    }, 6);
  }

  async emitComplianceAlert(alertData: any): Promise<void> {
    await this.emit(EventType.COMPLIANCE_ALERT, {
      type: alertData.type,
      severity: alertData.severity,
      details: alertData.details,
      requiresAction: alertData.requiresAction
    }, 10); // Critical priority
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
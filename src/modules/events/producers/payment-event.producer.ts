import { Injectable } from '@nestjs/common';
import { EventProducer, EventType } from './event.producer';

@Injectable()
export class PaymentEventProducer {
  constructor(private readonly eventProducer: EventProducer) {}

  async emitPaymentInitiated(paymentData: any): Promise<void> {
    await this.eventProducer.emit(EventType.PAYMENT_INITIATED, paymentData, 8);
  }

  async emitPaymentProcessing(paymentData: {
    paymentId: string;
    status: string;
  }): Promise<void> {
    await this.eventProducer.emit(EventType.PAYMENT_PROCESSING, paymentData, 7);
  }

  async emitPaymentCompleted(paymentData: {
    paymentId: string;
    settlementDate: Date;
    transactionReference: string;
    finalAmount: number;
  }): Promise<void> {
    await this.eventProducer.emit(EventType.PAYMENT_COMPLETED, paymentData, 9);
  }

  async emitPaymentFailed(paymentData: {
    paymentId: string;
    error: string;
    idempotencyKey?: string;
    timestamp: Date;
  }): Promise<void> {
    await this.eventProducer.emit(EventType.PAYMENT_FAILED, paymentData, 9);
  }

  async emitPaymentReversed(paymentData: {
    paymentId: string;
    reversalId: string;
    reason?: string;
  }): Promise<void> {
    await this.eventProducer.emit(EventType.PAYMENT_REVERSED, paymentData, 9);
  }
}
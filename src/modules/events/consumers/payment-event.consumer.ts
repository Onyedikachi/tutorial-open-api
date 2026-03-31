import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { EventType } from '../producers/event.producer';
import { AuditLogger } from '../../../common/services/audit-logger.service';
import { PaymentService } from 'src/modules/payments/payment.service';

@Controller()
export class PaymentEventConsumer {
  private readonly logger = new Logger(PaymentEventConsumer.name);

  constructor(
    private paymentService: PaymentService,
    private auditLogger: AuditLogger
  ) {}

  @EventPattern(EventType.PAYMENT_INITIATED)
  async handlePaymentInitiated(@Payload() event: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.log(`Processing payment initiated: ${event.data.paymentId}`);

      // Process payment in core banking system
      const result = await this.paymentService.processInCoreBanking(event.data);

      // Acknowledge message
      // channel.ack(originalMsg);

      // Log for audit
      await this.auditLogger.log({
        action: 'PAYMENT_PROCESSING_STARTED',
        timestamp: new Date(),
        details: event.data
      });

    } catch (error) {
      this.logger.error(`Failed to process payment: ${error.message}`);
      
      // Reject and requeue if temporary failure
      if (this.isRetryable(error)) {
        // channel.nack(originalMsg, false, true);
      } else {
        // Move to dead letter queue
        // channel.nack(originalMsg, false, false);
      }
    }
  }

  @EventPattern(EventType.PAYMENT_COMPLETED)
  async handlePaymentCompleted(@Payload() event: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.log(`Payment completed: ${event.data.paymentId}`);

      // Update payment status
      await this.paymentService.updatePaymentStatus(
        event.data.paymentId, 
        'completed',
        event.data
      );

      // Trigger notifications
      await this.triggerPaymentNotification(event.data);

      // channel.ack(originalMsg);

    } catch (error) {
      this.logger.error(`Failed to handle payment completion: ${error.message}`);
      // channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern(EventType.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() event: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.warn(`Payment failed: ${event.data.paymentId}`);

      // Update payment status
      await this.paymentService.updatePaymentStatus(
        event.data.paymentId,
        'failed',
        { error: event.data.error }
      );

      // Trigger failure notifications
      await this.triggerFailureNotification(event.data);

      // channel.ack(originalMsg);

    } catch (error) {
      this.logger.error(`Failed to handle payment failure: ${error.message}`);
      // channel.nack(originalMsg, false, true);
    }
  }

  private isRetryable(error: any): boolean {
    // Determine if error is retryable (network issues, temporary unavailability)
    const retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'SERVICE_UNAVAILABLE'];
    return retryableErrors.includes(error.code);
  }

  private async triggerPaymentNotification(data: any): Promise<void> {
    // Implement notification logic (SMS, Email, Push)
    this.logger.log(`Triggering payment notification for: ${data.paymentId}`);
  }

  private async triggerFailureNotification(data: any): Promise<void> {
    // Implement failure notification logic
    this.logger.log(`Triggering failure notification for: ${data.paymentId}`);
  }
}
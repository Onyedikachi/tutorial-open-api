import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { EventType } from '../producers/event.producer';
import { AuditLogger } from 'src/common/services/audit-logger.service';


@Controller()
export class AuditEventConsumer {
  private readonly logger = new Logger(AuditEventConsumer.name);

  constructor(private auditLogger: AuditLogger) {}

  @EventPattern(EventType.AUDIT_LOG)
  async handleAuditLog(@Payload() event: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.auditLogger.log(event.data);
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Failed to process audit log: ${error.message}`);
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern(EventType.COMPLIANCE_ALERT)
  async handleComplianceAlert(@Payload() event: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      // Send compliance alert to regulatory reporting system
      this.logger.warn(`Compliance alert: ${JSON.stringify(event.data)}`);
      channel.ack(originalMsg);
    } catch (error) {
      channel.nack(originalMsg, false, true);
    }
  }
}
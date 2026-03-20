import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { EventType } from '../producers/event.producer';

@Controller()
export class NotificationEventConsumer {
  private readonly logger = new Logger(NotificationEventConsumer.name);

  @EventPattern(EventType.NOTIFICATION_SENT)
  async handleNotification(@Payload() event: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      // Send email/SMS/push notification
      this.logger.log(`Sending notification: ${JSON.stringify(event.data)}`);
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Notification failed: ${error.message}`);
      channel.nack(originalMsg, false, true);
    }
  }
}
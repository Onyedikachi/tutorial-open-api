import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventProducer } from './producers/event.producer';
import { PaymentEventConsumer } from './consumers/payment-event.consumer';
import { AuditEventConsumer } from './consumers/audit-event.consumer';
import { NotificationEventConsumer } from './consumers/notification-event.consumer';

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'openbanking_events',
          queueOptions: {
            durable: true,
            arguments: {
              'x-max-priority': 10,
              'x-message-ttl': 86400000 // 24 hours
            }
          },
          persistent: true,
          noAck: false,
        },
      },
    ]),
  ],
  providers: [
    EventProducer,
    PaymentEventConsumer,
    AuditEventConsumer,
    NotificationEventConsumer
  ],
  exports: [EventProducer]
})
export class EventsModule {}
import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventProducer } from './producers/event.producer';
import { PaymentEventConsumer } from './consumers/payment-event.consumer';
import { AuditEventConsumer } from './consumers/audit-event.consumer';
import { NotificationEventConsumer } from './consumers/notification-event.consumer';
import { PaymentEventProducer } from './producers/payment-event.producer';
import { PaymentService } from '../payments/payment.service';
import { AuditLogger } from 'src/common/services/audit-logger.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from 'src/common/entities/audit-log.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
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
          noAck: true,
          // noAck: false,
        },
      },
    ]),
  ],
  providers: [
    EventProducer,
    PaymentEventConsumer,
    AuditEventConsumer,
    NotificationEventConsumer,
    PaymentEventProducer,
    PaymentService,
    AuditLogger,
  ],
  exports: [EventProducer, PaymentEventProducer]
})
export class EventsModule {}
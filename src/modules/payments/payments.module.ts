import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { IdempotentPaymentService } from './idempotent-payment.service';
import { IdempotentRequest } from './entities/idempotent-request.entity';
import { EventProducer } from '../events/producers/event.producer';
import { PaymentEventProducer } from '../events/producers/payment-event.producer';
import { PaymentSaga } from '../saga/sagas/payment.saga';
import { SagaModule } from '../saga/saga.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdempotentRequest]),
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'openbanking_events',
          queueOptions: { durable: true },
        },
      },
    ]),
    CacheModule.register({
      ttl: 60, //seconds
      max: 100, 
      isGlobal: false, 
    }),
    SagaModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, IdempotentPaymentService, EventProducer, PaymentEventProducer],
})
export class PaymentsModule {}
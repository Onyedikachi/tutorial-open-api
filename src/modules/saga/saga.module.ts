import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SagaOrchestrator } from './saga.orchestrator';
import { SagaRepository } from './saga.repository';
import { SagaExecution } from './entities/saga-execution.entity';
import { SagaStep } from './entities/saga-step.entity';
import { PaymentSaga } from './sagas/payment.saga';
import { ConsentSaga } from './sagas/consent.saga';
import { EventsModule } from '../events/events.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SagaExecution, SagaStep]),
    EventsModule,
  ],
  providers: [
    SagaOrchestrator,
    SagaRepository,
    PaymentSaga,
    ConsentSaga,
  ],
  exports: [SagaOrchestrator, PaymentSaga, ConsentSaga],
})
export class SagaModule {}
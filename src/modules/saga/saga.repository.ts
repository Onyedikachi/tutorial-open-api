import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { SagaExecution, SagaStatus, } from './entities/saga-execution.entity';
import { SagaStep, StepStatus,} from './entities/saga-step.entity';


@Injectable()
export class SagaRepository {
  constructor(
    @InjectRepository(SagaExecution)
    private executionRepository: Repository<SagaExecution>,
    @InjectRepository(SagaStep)
    private stepRepository: Repository<SagaStep>,
  ) {}

  async createSaga(
    sagaType: string,
    businessId: string,
    payload: any,
    steps: { name: string; order: number; data: any; compensationData: any }[],
    manager?: EntityManager,
  ): Promise<SagaExecution> {
    const repo = manager ? manager.getRepository(SagaExecution) : this.executionRepository;
    const stepRepo = manager ? manager.getRepository(SagaStep) : this.stepRepository;

    const execution = repo.create({
      sagaType,
      businessId,
      payload,
      status: 'STARTED',
    });

    const savedExecution = await repo.save(execution);

    const sagaSteps = steps.map((step) =>
      stepRepo.create({
        sagaExecution: savedExecution,
        stepName: step.name,
        stepOrder: step.order,
        status: 'PENDING',
        stepData: step.data,
        compensationData: step.compensationData,
      }),
    );

    await stepRepo.save(sagaSteps);
    
    savedExecution.steps = sagaSteps;
    return savedExecution;
  }

  async updateStepStatus(
    executionId: string,
    stepName: string,
    status: StepStatus,
    errorMessage?: string,
    manager?: EntityManager,
  ): Promise<void> {
    const stepRepo = manager ? manager.getRepository(SagaStep) : this.stepRepository;

    await stepRepo.update(
      { sagaExecution: { id: executionId }, stepName },
      { 
        status,
        ...(errorMessage && { errorMessage }),
        ...(status === 'COMPENSATED' && { compensatedAt: new Date() }),
      },
    );
  }

  async updateSagaStatus(
    executionId: string,
    status: SagaStatus,
    failedStep?: string,
    errorMessage?: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(SagaExecution) : this.executionRepository;

    await repo.update(
      { id: executionId },
      {
        status,
        ...(failedStep && { failedStep }),
        ...(errorMessage && { errorMessage }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
      },
    );
  }

  async findSagaByBusinessId(businessId: string): Promise<SagaExecution | null> {
    return this.executionRepository.findOne({
      where: { businessId },
      relations: ['steps'],
    });
  }

  async findActiveSaga(businessId: string): Promise<SagaExecution | null> {
    return this.executionRepository.findOne({
      where: {
        businessId,
        status: 'STARTED',
      },
      relations: ['steps'],
    });
  }
}
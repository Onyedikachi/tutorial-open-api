import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { SagaRepository } from './saga.repository';
import { EventProducer } from '../events/producers/event.producer';
import { EventType } from '../events/producers/event.producer';

export interface SagaStepHandler {
  execute(stepData: any): Promise<any>;
  compensate(compensationData: any): Promise<void>;
}

@Injectable()
export class SagaOrchestrator {
  private readonly logger = new Logger(SagaOrchestrator.name);
  private stepHandlers: Map<string, SagaStepHandler> = new Map();

  constructor(
    private sagaRepository: SagaRepository,
    private eventProducer: EventProducer,
  ) {}

  registerStepHandler(stepName: string, handler: SagaStepHandler) {
    this.stepHandlers.set(stepName, handler);
  }

  async startSaga(
    sagaType: string,
    businessId: string,
    payload: any,
    steps: { name: string; order: number; data: any; compensationData: any }[],
    transactionalEntityManager?: EntityManager,
  ): Promise<string> {
    const executeSaga = async (manager: EntityManager) => {
      const execution = await this.sagaRepository.createSaga(
        sagaType,
        businessId,
        payload,
        steps,
        manager,
      );

      // Execute first step
      await this.executeNextStep(execution.id, manager);

      return execution.id;
    };

    if (transactionalEntityManager) {
      return executeSaga(transactionalEntityManager);
    } else {
      // Start new transaction
      // Note: In real implementation, you'd use @Transactional() decorator
      // return executeSaga(null);

      return ''
    }
  }

  private async executeNextStep(
    executionId: string,
    manager?: EntityManager,
  ) {
    const execution = await this.sagaRepository.findSagaByBusinessId(executionId);
    
    if (!execution || execution.status !== 'STARTED') {
      return;
    }

    // Find next pending step
    const nextStep = execution.steps
      .filter((s) => s.status === 'PENDING')
      .sort((a, b) => a.stepOrder - b.stepOrder)[0];

    if (!nextStep) {
      // All steps completed
      await this.sagaRepository.updateSagaStatus(executionId, 'COMPLETED', undefined, undefined, manager);
      await this.eventProducer.emit(EventType.SAGA_COMPLETED, {
        sagaId: executionId,
        businessId: execution.businessId,
        sagaType: execution.sagaType,
      });
      return;
    }

    try {
      const handler = this.stepHandlers.get(nextStep.stepName);
      if (!handler) {
        throw new Error(`No handler registered for step: ${nextStep.stepName}`);
      }

      // Execute step
      const result = await handler.execute(nextStep.stepData);

      // Update step status
      await this.sagaRepository.updateStepStatus(
        executionId,
        nextStep.stepName,
        'COMPLETED',
        undefined,
        manager,
      );

      // Emit step completed event
      await this.eventProducer.emit(EventType.SAGA_STEP_COMPLETED, {
        sagaId: executionId,
        stepName: nextStep.stepName,
        result,
      });

      // Execute next step
      await this.executeNextStep(executionId, manager);
    } catch (error) {
      this.logger.error(`Step ${nextStep.stepName} failed: ${error.message}`);
      
      // Update step status
      await this.sagaRepository.updateStepStatus(
        executionId,
        nextStep.stepName,
        'FAILED',
        error.message,
        manager,
      );

      // Start compensation
      await this.compensateSaga(executionId, nextStep.stepName, error.message, manager);
    }
  }

  private async compensateSaga(
    executionId: string,
    failedStep: string,
    errorMessage: string,
    manager?: EntityManager,
  ) {
    await this.sagaRepository.updateSagaStatus(
      executionId,
      'COMPENSATING',
      failedStep,
      errorMessage,
      manager,
    );

    const execution = await this.sagaRepository.findSagaByBusinessId(executionId);
    
    // Execute compensation in reverse order
    const completedSteps = execution?.steps
      .filter((s) => s.status === 'COMPLETED')
      .sort((a, b) => b.stepOrder - a.stepOrder);

    for (const step of (completedSteps ?? [])) {
      try {
        const handler = this.stepHandlers.get(step.stepName);
        if (handler) {
          await handler.compensate(step.compensationData);
          
          await this.sagaRepository.updateStepStatus(
            executionId,
            step.stepName,
            'COMPENSATED',
            undefined,
            manager,
          );
        }
      } catch (compError) {
        this.logger.error(`Compensation failed for step ${step.stepName}: ${compError.message}`);
        // Log critical error - manual intervention required
        await this.eventProducer.emit(EventType.SAGA_COMPENSATION_FAILED, {
          sagaId: executionId,
          stepName: step.stepName,
          error: compError.message,
        });
      }
    }

    await this.sagaRepository.updateSagaStatus(executionId, 'FAILED', failedStep, errorMessage, manager);
    
    await this.eventProducer.emit(EventType.SAGA_FAILED, {
      sagaId: executionId,
      failedStep,
      errorMessage,
    });
  }
}
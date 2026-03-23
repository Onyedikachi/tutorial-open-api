import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SagaExecution } from './saga-execution.entity';

export type StepStatus = 'PENDING' | 'COMPLETED' | 'COMPENSATED' | 'FAILED';

@Entity('saga_steps')
export class SagaStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SagaExecution, (execution) => execution.steps)
  @JoinColumn({ name: 'saga_execution_id' })
  sagaExecution: SagaExecution;

  @Column()
  stepName: string; // 'debit_account', 'credit_account', 'update_ledger', etc.

  @Column()
  stepOrder: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'COMPLETED', 'COMPENSATED', 'FAILED'],
    default: 'PENDING',
  })
  status: StepStatus;

  @Column('jsonb')
  stepData: any;

  @Column('jsonb', { nullable: true })
  compensationData: any; // Data needed to undo this step

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  executedAt: Date;

  @Column({ nullable: true })
  compensatedAt: Date;
}
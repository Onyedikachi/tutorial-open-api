import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { SagaStep } from './saga-step.entity';

export type SagaStatus = 'STARTED' | 'COMPENSATING' | 'COMPLETED' | 'FAILED';

@Entity('saga_executions')
export class SagaExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sagaType: string; // 'PAYMENT', 'CONSENT', etc.

  @Column()
  businessId: string; // e.g., payment_id, consent_id

  @Column('jsonb')
  payload: any;

  @Column({
    type: 'enum',
    enum: ['STARTED', 'COMPENSATING', 'COMPLETED', 'FAILED'],
    default: 'STARTED',
  })
  status: SagaStatus;

  @OneToMany(() => SagaStep, (step) => step.sagaExecution, { cascade: true })
  steps: SagaStep[];

  @Column({ nullable: true })
  failedStep: string;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;
}
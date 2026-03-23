import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('idempotent_requests')
@Index(['idempotencyKey'], { unique: true })
export class IdempotentRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  idempotencyKey: string;

  @Column('jsonb')
  paymentData: any;

  @Column({ default: 'processing' })
  status: 'processing' | 'completed' | 'failed';

  @Column('jsonb', { nullable: true })
  response: any;

  @Column({ nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;
}

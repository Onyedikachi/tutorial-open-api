import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  clientId?: string;

  @Column('jsonb')
  details: any;

  @CreateDateColumn()
  timestamp: Date;

  @Column()
  hash: string;

  @Column({ nullable: true })
  previousHash: string;

  @Column({ default: false })
  backedUp: boolean;
}
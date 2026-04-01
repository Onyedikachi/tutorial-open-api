import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne } from 'typeorm';
import { AuthorizationCode } from './authorization-code.entity';

@Entity('consent_requests')
export class ConsentRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @Column('simple-array')
  scope: string[];

  @Column('simple-array', { nullable: true })
  accounts: string[];

  @Column()
  redirectUri: string;

  @Column({ nullable: true })
  codeChallenge: string;

  @Column({ default: 'S256' })
  codeChallengeMethod: string;

  @Column({ nullable: true })
  nonce: string;

  @Column({ nullable: true })
  state: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'approved' | 'denied';

  @Column({ nullable: true })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ nullable: true })
  processedAt: Date;

  @OneToOne(() => AuthorizationCode, (code) => code.consentRequest)
  authorizationCode: AuthorizationCode;
}
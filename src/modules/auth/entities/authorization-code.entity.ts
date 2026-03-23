import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { ConsentRequest } from './consent-request.entity';

@Entity('authorization_codes')
export class AuthorizationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  // @OneToOne(() => ConsentRequest)
  // @JoinColumn()
  // consentRequest: ConsentRequest;
  @ManyToOne(() => ConsentRequest, (cr) => cr.authorizationCode)
  @JoinColumn()
  consentRequest: ConsentRequest;

  @Column()
  clientId: string;

  @Column({ nullable: true })
  userId: string;

  @Column('simple-array')
  scope: string[];

  @Column({ nullable: true })
  codeChallenge: string;

  @Column({ nullable: true })
  codeChallengeMethod: string;

  @Column()
  redirectUri: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;
}
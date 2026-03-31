import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuditLogger {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(data: {
    action: string;
    userId?: string;
    clientId?: string;
    details: any;
    timestamp: Date;
  }): Promise<void> {
    // Create hash for tamper detection
    const hash = this.createHash(data);

    const auditEntry = this.auditRepository.create({
      ...data,
      hash,
      previousHash: await this.getLastHash(),
    });

    await this.auditRepository.save(auditEntry);

    // For CBN compliance, ensure logs are immutable and stored for 7+ years
    await this.backupToColdStorage(auditEntry);
  }

  private createHash(data: any): string {
    const content = JSON.stringify(data) + data.timestamp;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // private async getLastHash(): Promise<string> {
  //   const lastEntry = await this.auditRepository.findOne({
  //     order: { id: 'DESC' }
  //   });
  //   return lastEntry?.hash || '0';
  // }
  private async getLastHash(): Promise<string> {
    const lastEntry = await this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.timestamp', 'DESC')
      .getOne();

    return lastEntry?.hash || '0';
  }

  private async backupToColdStorage(entry: AuditLog): Promise<void> {
    // Implement backup to immutable storage (e.g., AWS S3 Glacier, Write-Once storage)
    // This ensures 7-year retention as per CBN requirements
  }
}

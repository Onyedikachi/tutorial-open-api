import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotentRequest } from './entities/idempotent-request.entity';
import { PaymentEventProducer } from '../events/producers/payment-event.producer';

@Injectable()
export class IdempotentPaymentService {
  constructor(
    @InjectRepository(IdempotentRequest)
    private idempotentRepo: Repository<IdempotentRequest>,
    private paymentEventProducer: PaymentEventProducer,
  ) {}

  async processPayment(idempotencyKey: string, paymentData: any): Promise<any> {
    const existing = await this.idempotentRepo.findOne({ where: { idempotencyKey } });
    if (existing) {
      if (existing.status === 'completed') return existing.response;
      if (existing.status === 'processing') throw new ConflictException('Request already processing');
    }

    const request = this.idempotentRepo.create({
      idempotencyKey,
      paymentData,
      status: 'processing',
    });
    await this.idempotentRepo.save(request);

    try {
      // Simulate payment processing
      const result = { paymentId: `pay_${Date.now()}`, status: 'success' };
      request.status = 'completed';
      request.response = result;
      request.completedAt = new Date();
      await this.idempotentRepo.save(request);

      await this.paymentEventProducer.emitPaymentCompleted({
        paymentId: result.paymentId,
        settlementDate: new Date(),
        transactionReference: `ref_${Date.now()}`,
        finalAmount: paymentData.amount,
      });
      return result;
    } catch (error) {
      request.status = 'failed';
      request.error = error.message;
      await this.idempotentRepo.save(request);
      throw error;
    }
  }
}
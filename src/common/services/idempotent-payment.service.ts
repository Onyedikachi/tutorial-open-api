import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentEventProducer } from 'src/modules/events/producers/payment-event.producer';
import { IdempotentRequest } from 'src/modules/payments/entities/idempotent-request.entity';
import { Repository } from 'typeorm';


@Injectable()
export class IdempotentPaymentService {
  constructor(
    @InjectRepository(IdempotentRequest)
    private idempotentRepository: Repository<IdempotentRequest>,
    private eventProducer: PaymentEventProducer
  ) {}

  async processPayment(idempotencyKey: string, paymentData: any): Promise<any> {
    // Check for existing request
    const existingRequest = await this.idempotentRepository.findOne({
      where: { idempotencyKey }
    });

    if (existingRequest) {
      if (existingRequest.status === 'completed') {
        return existingRequest.response;
      } else if (existingRequest.status === 'processing') {
        throw new ConflictException('Request is already being processed');
      }
    }

    // Create new idempotent request
    const request = this.idempotentRepository.create({
      idempotencyKey,
      paymentData,
      status: 'processing',
      createdAt: new Date()
    });

    await this.idempotentRepository.save(request);

    try {
      // Process payment
      const result = await this.executePayment(paymentData);
      
      // Update request with success
      request.status = 'completed';
      request.response = result;
      request.completedAt = new Date();
      await this.idempotentRepository.save(request);

      // Emit payment success event
      await this.eventProducer.emitPaymentCompleted({
        paymentId: result.paymentId,
        settlementDate: new Date(),
        transactionReference: '',
        finalAmount: 9993,
      });
  
      return result;
    } catch (error) {
      // Update request with failure
      request.status = 'failed';
      request.error = error.message;
      await this.idempotentRepository.save(request);

      // Emit payment failure event
      await this.eventProducer.emitPaymentFailed({
        idempotencyKey,
        error: error.message,
        timestamp: new Date(),
        paymentId: ''
      });

      throw error;
    }
  }

  private async executePayment(paymentData: any): Promise<any> {
    // Actual payment processing logic
    // This would integrate with core banking system
    return {
      paymentId: `pay_${Date.now()}`,
      status: 'processing',
      timestamp: new Date()
    };
  }
}
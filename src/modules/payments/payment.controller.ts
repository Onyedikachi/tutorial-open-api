import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseInterceptors,
  Req,
  ConflictException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';

import { PaymentService } from './payment.service';

import { PaymentSaga } from '../saga/sagas/payment.saga';
import { Idempotent } from '../../common/decorators/idempotency.decorator';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { ISO20022PaymentDTO } from './dto/iso20022-payment.dto';
import { ProblemDetailsException } from '../../common/exceptions/problem-details.exception';
import { EventProducer, EventType } from '../events/producers/event.producer';

import { IdempotentPaymentService } from './idempotent-payment.service';
import { InjectRepository } from '@nestjs/typeorm';
import { IdempotentRequest } from './entities/idempotent-request.entity';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { type Cache } from 'cache-manager';
import type Redis from 'ioredis';

@Controller('payments')
@UseInterceptors(IdempotencyInterceptor)
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private idempotentService: IdempotentPaymentService,
    private paymentSaga: PaymentSaga,
    private eventProducer: EventProducer,

    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject('REDIS_CLIENT') private redis: Redis,
    @InjectRepository(IdempotentRequest)
    private idempotentRepo: Repository<IdempotentRequest>,
  ) {}

  @Post()
  @Idempotent()
  async initiatePayment(
    @Body() paymentDTO: ISO20022PaymentDTO,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req,
  ) {
    // Primary enforcement (product entitlement, mTLS, rate limiting) happens
    // at the API gateway before this request ever arrives here. This is
    // defense-in-depth on the identity GatewayTrustMiddleware already
    // verified and attached to req.client from the gateway's forwarded
    // headers - it does not re-derive trust on its own.
    this.requireAccessRule(req, 'pist_access');

    if (!idempotencyKey) {
      throw new ConflictException('Missing idempotency key');
    }

    if (paymentDTO.instructedAmount.value <= 0) {
      throw new ProblemDetailsException({
        type: 'https://api.openbanking.ng/errors/invalid-amount',
        title: 'Invalid Amount',
        status: 422,
        detail: 'Amount must be positive',
        instance: req.path,
      });
    }

    const cacheKey = `idempotency:${idempotencyKey}`;
    const lockKey = `lock:${idempotencyKey}`;

    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    //  Acquire atomic lock (critical)
    const lock = await this.redis.set(lockKey, '1', 'EX', 60, 'NX');
  
    if (!lock) {
      throw new ConflictException('Request already processing');
    }

    try {
      // Generate payment
      const paymentId = `pay_${Date.now()}`;

      // Persist initial request (audit trail)
      await this.idempotentRepo.save({
        idempotencyKey,
        paymentData: paymentDTO,
        status: 'processing',
      });

      // Start saga
      const sagaId = await this.paymentSaga.initiatePayment({
        paymentId,
        amount: paymentDTO.instructedAmount.value,
        currency: paymentDTO.instructedAmount.currency,
        debtorAccount: paymentDTO.debtor.account.iban,
        creditorAccount: paymentDTO.creditor.account.iban,
        description: paymentDTO.remittanceInformation,
      });

      const response = {
        paymentId,
        sagaId,
        status: 'processing',
        idempotencyKey,
        links: {
          status: `/payments/${paymentId}/status`,
        },
      };

      // Cache response (idempotency replay)
      await this.cacheManager.set(cacheKey, response, 300);

      return response;
    } catch (error) {
      await this.redis.del(lockKey);
      throw error;
    }
  }

  @Get(':paymentId/status')
  async getPaymentStatus(@Param('paymentId') paymentId: string) {
    const status = await this.paymentService.getPaymentStatus(paymentId);
    return {
      paymentId,
      status: status.state,
      settlementDate: status.settlementDate,
    };
  }

  @Post(':paymentId/reverse')
  @Idempotent()
  async reversePayment(
    @Param('paymentId') paymentId: string,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    const reversal = await this.paymentService.reversePayment(paymentId);

    await this.eventProducer.emit(EventType.PAYMENT_REVERSED, {
      paymentId,
      reversalId: reversal.id,
      timestamp: new Date(),
    });

    return reversal;
  }

  @Post('pift/schedule')
  @Idempotent()
  async scheduleFuturePayment(
    @Body() paymentDTO: ISO20022PaymentDTO & { executionDate: Date },
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req,
  ) {
    this.requireAccessRule(req, 'pift_access');

    const executionDate = new Date(paymentDTO.executionDate);
    if (isNaN(executionDate.getTime()) || executionDate <= new Date()) {
      throw new ProblemDetailsException({
        type: 'https://api.openbanking.ng/errors/invalid-execution-date',
        title: 'Invalid Execution Date',
        status: 422,
        detail: 'executionDate must be a valid future date',
        instance: req.path,
      });
    }

    const paymentId = `pift_${Date.now()}`;

    const sagaId = await this.paymentSaga.initiatePayment({
      paymentId,
      amount: paymentDTO.instructedAmount.value,
      currency: paymentDTO.instructedAmount.currency,
      debtorAccount: paymentDTO.debtor.account.iban,
      creditorAccount: paymentDTO.creditor.account.iban,
      description: paymentDTO.remittanceInformation,
    });

    // Store future execution date
    await this.paymentService.scheduleFuturePayment(paymentId, paymentDTO.executionDate);

    return {
      paymentId,
      sagaId,
      status: 'scheduled',
      executionDate: paymentDTO.executionDate,
      idempotencyKey,
    };
  }

  private requireAccessRule(req, rule: string): void {
    const accessRules: string[] | undefined = req.client?.accessRules;
    if (!accessRules?.includes(rule)) {
      throw new ForbiddenException(`'${rule}' access rule not granted for this TPP`);
    }
  }
}

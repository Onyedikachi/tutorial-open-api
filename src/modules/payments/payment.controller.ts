

import { Controller, Post, Get, Body, Param, Headers, UseInterceptors, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';

import { PaymentSaga } from '../saga/sagas/payment.saga';
import { Idempotent } from '../../common/decorators/idempotency.decorator';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { ISO20022PaymentDTO } from './dto/iso20022-payment.dto';
import { ProblemDetailsException } from '../../common/exceptions/problem-details.exception';
import { EventProducer, EventType } from '../events/producers/event.producer';


import { PISTGuard } from '../gateway/guards/pist.guard';
import { PIFTGuard } from '../gateway/guards/pift.guard';
import { IdempotentPaymentService } from './idempotent-payment.service';

@Controller('payments')
@UseInterceptors(IdempotencyInterceptor)
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private idempotentService: IdempotentPaymentService,
    private paymentSaga: PaymentSaga,
    private eventProducer: EventProducer,
  ) {}

  @Post()
  @Idempotent()
  async initiatePayment(
    @Body() paymentDTO: ISO20022PaymentDTO,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req,
  ) {
    if (paymentDTO.instructedAmount.value <= 0) {
      throw new ProblemDetailsException({
        type: 'https://api.openbanking.ng/errors/invalid-amount',
        title: 'Invalid Amount',
        status: 422,
        detail: 'Amount must be positive',
        instance: req.path,
      });
    }

    const paymentId = `pay_${Date.now()}`;

    // Start distributed transaction via saga
    const sagaId = await this.paymentSaga.initiatePayment({
      paymentId,
      amount: paymentDTO.instructedAmount.value,
      currency: paymentDTO.instructedAmount.currency,
      debtorAccount: paymentDTO.debtor.account.iban,
      creditorAccount: paymentDTO.creditor.account.iban,
      description: paymentDTO.remittanceInformation,
    });

    // / Process with idempotency
    // const result = await this.idempotentService.processPayment(
    //   idempotencyKey,
    //   paymentDTO
    // );

    // // Emit event for async processing
    // await this.eventProducer.emitPaymentInitiated({
    //   paymentId: result.paymentId,
    //   ...paymentDTO,
    //   idempotencyKey
    // });

    // return {
    //   paymentId: result.paymentId,
    //   status: 'processing',
    //   idempotencyKey,
    //   links: {
    //     status: `/payments/${result.paymentId}/status`
    //   }
    // };


    return {
      paymentId,
      sagaId,
      status: 'processing',
      idempotencyKey,
      links: { status: `/payments/${paymentId}/status` },
    };
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
    @Headers('idempotency-key') idempotencyKey: string
  ) {
    const reversal = await this.paymentService.reversePayment(paymentId);

    await this.eventProducer.emit(EventType.PAYMENT_REVERSED, {
      paymentId,
      reversalId: reversal.id,
      timestamp: new Date()
    });

    return reversal;
  }

  //   @Post('pift/schedule')
  // @UseGuards(PIFTGuard)
  // @Idempotent()
  // async scheduleFuturePayment(
  //   @Body() paymentDTO: ISO20022PaymentDTO & { executionDate: Date },
  //   @Headers('idempotency-key') idempotencyKey: string,
  // ) {
  //   // PIFT requires encrypted JWT (enforced by middleware)
  //   const paymentId = `pift_${Date.now()}`;

  //   const sagaId = await this.paymentSaga.initiatePayment({
  //     paymentId,
  //     amount: paymentDTO.instructedAmount.value,
  //     currency: paymentDTO.instructedAmount.currency,
  //     debtorAccount: paymentDTO.debtor.account.iban,
  //     creditorAccount: paymentDTO.creditor.account.iban,
  //     description: paymentDTO.remittanceInformation,
  //   });

  //   // Store future execution date
  //   await this.paymentService.scheduleFuturePayment(paymentId, paymentDTO.executionDate);

  //   return {
  //     paymentId,
  //     sagaId,
  //     status: 'scheduled',
  //     executionDate: paymentDTO.executionDate,
  //     idempotencyKey,
  //   };
  // }

}
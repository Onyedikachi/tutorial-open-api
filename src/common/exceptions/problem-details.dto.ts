// problem-details.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IProblemDetails,
  IValidationProblemDetails,
  IBusinessRuleViolationDetails,
  IConsentProblemDetails,
  IPaymentProblemDetails,
} from './problem-details.interface';

export class ProblemDetails implements IProblemDetails {
  @ApiProperty()
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  status: number;

  @ApiProperty()
  detail: string;

  @ApiPropertyOptional()
  instance?: string;

  [key: string]: any;
}

export class ValidationProblemDetails
  extends ProblemDetails
  implements IValidationProblemDetails
{
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        message: { type: 'string' },
        rejectedValue: { type: 'object' },
      },
    },
  })
  errors: {
    field: string;
    message: string;
    rejectedValue?: any;
  }[];
}

export class BusinessRuleViolationDetails
  extends ProblemDetails
  implements IBusinessRuleViolationDetails
{
  @ApiProperty()
  rule: string;

  @ApiProperty()
  constraint: string;

  @ApiPropertyOptional()
  currentValue?: any;

  @ApiPropertyOptional({ type: [Object] })
  allowedValues?: any[];
}

export class ConsentProblemDetails
  extends ProblemDetails
  implements IConsentProblemDetails
{
  @ApiPropertyOptional()
  consentId?: string;

  @ApiPropertyOptional({ type: [String] })
  missingPermissions?: string[];

  @ApiPropertyOptional()
  expiredAt?: Date;
}

export class PaymentProblemDetails
  extends ProblemDetails
  implements IPaymentProblemDetails
{
  @ApiPropertyOptional()
  paymentId?: string;

  @ApiPropertyOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  failedStep?: string;

  @ApiPropertyOptional()
  sagaId?: string;
}
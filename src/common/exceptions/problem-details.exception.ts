import { HttpException, HttpStatus } from '@nestjs/common';
import { 
  BusinessRuleViolationDetails, 
  ConsentProblemDetails, 
  PaymentProblemDetails, 
  ProblemDetails, 
  ValidationProblemDetails 
} from './problem-details.dto';

export class ProblemDetailsException extends HttpException {
  constructor(problemDetails: ProblemDetails) {
    const { status, title, detail, type, instance, ...extensions } = problemDetails;
    
    super(
      {
        type: type || 'about:blank',
        title,
        status,
        detail,
        instance,
        ...extensions,
      },
      status,
    );
  }
}

export class ValidationProblemDetailsException extends ProblemDetailsException {
  constructor(
    errors: { field: string; message: string; rejectedValue?: any }[],
    instance?: string,
  ) {
    const problemDetails: ValidationProblemDetails = {
      type: 'https://api.openbanking.ng/errors/validation-error',
      title: 'Validation Error',
      status: HttpStatus.BAD_REQUEST,
      detail: 'The request contains invalid fields',
      instance,
      errors,
    };
    
    super(problemDetails);
  }
}

export class BusinessRuleViolationException extends ProblemDetailsException {
  constructor(
    rule: string,
    constraint: string,
    detail: string,
    currentValue?: any,
    allowedValues?: any[],
    instance?: string,
  ) {
    const problemDetails: BusinessRuleViolationDetails = {
      type: 'https://api.openbanking.ng/errors/business-rule-violation',
      title: 'Business Rule Violation',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail,
      instance,
      rule,
      constraint,
      currentValue,
      allowedValues,
    };
    
    super(problemDetails);
  }
}

export class ConsentException extends ProblemDetailsException {
  constructor(
    title: string,
    detail: string,
    status: HttpStatus,
    consentId?: string,
    missingPermissions?: string[],
    expiredAt?: Date,
    instance?: string,
  ) {
    const problemDetails: ConsentProblemDetails = {
      type: 'https://api.openbanking.ng/errors/consent-error',
      title,
      status,
      detail,
      instance,
      consentId,
      missingPermissions,
      expiredAt,
    };
    
    super(problemDetails);
  }
}

export class PaymentException extends ProblemDetailsException {
  constructor(
    title: string,
    detail: string,
    status: HttpStatus,
    paymentId?: string,
    idempotencyKey?: string,
    failedStep?: string,
    sagaId?: string,
    instance?: string,
  ) {
    const problemDetails: PaymentProblemDetails = {
      type: 'https://api.openbanking.ng/errors/payment-error',
      title,
      status,
      detail,
      instance,
      paymentId,
      idempotencyKey,
      failedStep,
      sagaId,
    };
    
    super(problemDetails);
  }
}

export class InsufficientScopeException extends ProblemDetailsException {
  constructor(requiredScope: string, currentScopes: string[], instance?: string) {
    super({
      type: 'https://api.openbanking.ng/errors/insufficient-scope',
      title: 'Insufficient Scope',
      status: HttpStatus.FORBIDDEN,
      detail: `The token lacks the required scope: ${requiredScope}`,
      instance,
      requiredScope,
      currentScopes,
    });
  }
}

export class ConsentRequiredException extends ProblemDetailsException {
  constructor(clientId: string, missingPermissions: string[], instance?: string) {
    super({
      type: 'https://api.openbanking.ng/errors/consent-required',
      title: 'Consent Required',
      status: HttpStatus.FORBIDDEN,
      detail: 'User consent is required for this operation',
      instance,
      clientId,
      missingPermissions,
      consentUrl: `${process.env.CONSENT_UI_URL}/authorize?client_id=${clientId}&scope=${missingPermissions.join(' ')}`,
    });
  }
}
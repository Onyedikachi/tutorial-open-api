// problem-details.interface.ts

export interface IProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  [key: string]: any;
}

export interface IValidationProblemDetails extends IProblemDetails {
  errors: {
    field: string;
    message: string;
    rejectedValue?: any;
  }[];
}

export interface IBusinessRuleViolationDetails extends IProblemDetails {
  rule: string;
  constraint: string;
  currentValue?: any;
  allowedValues?: any[];
}

export interface IConsentProblemDetails extends IProblemDetails {
  consentId?: string;
  missingPermissions?: string[];
  expiredAt?: Date;
}

export interface IPaymentProblemDetails extends IProblemDetails {
  paymentId?: string;
  idempotencyKey?: string;
  failedStep?: string;
  sagaId?: string;
}
import { applyDecorators } from '@nestjs/common';
import { ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { 
  ProblemDetails, 
  ValidationProblemDetails, 
  BusinessRuleViolationDetails,
  ConsentProblemDetails,
  PaymentProblemDetails 
} from '../exceptions/problem-details.dto';

export const ApiProblemDetails = (
  status: number,
  description: string,
  problemType?: string,
) => {
  return applyDecorators(
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ProblemDetails) },
          {
            properties: {
              type: { 
                example: problemType || `https://api.openbanking.ng/errors/${status}` 
              },
              status: { example: status },
            },
          },
        ],
      },
    }),
  );
};

export const ApiValidationProblemDetails = () => {
  return applyDecorators(
    ApiExtraModels(ValidationProblemDetails),
    ApiResponse({
      status: 400,
      description: 'Validation error',
      schema: {
        allOf: [
          { $ref: getSchemaPath(ValidationProblemDetails) },
          {
            properties: {
              type: { example: 'https://api.openbanking.ng/errors/validation-error' },
              status: { example: 400 },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                    rejectedValue: { type: 'object' },
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
};

export const ApiConsentProblemDetails = () => {
  return applyDecorators(
    ApiExtraModels(ConsentProblemDetails),
    ApiResponse({
      status: 403,
      description: 'Consent required or invalid',
      schema: {
        allOf: [
          { $ref: getSchemaPath(ConsentProblemDetails) },
          {
            properties: {
              type: { example: 'https://api.openbanking.ng/errors/consent-error' },
              consentId: { type: 'string' },
              missingPermissions: { type: 'array', items: { type: 'string' } },
              expiredAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
    }),
  );
};

export const ApiPaymentProblemDetails = () => {
  return applyDecorators(
    ApiExtraModels(PaymentProblemDetails),
    ApiResponse({
      status: 422,
      description: 'Payment processing error',
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaymentProblemDetails) },
          {
            properties: {
              type: { example: 'https://api.openbanking.ng/errors/payment-error' },
              paymentId: { type: 'string' },
              idempotencyKey: { type: 'string' },
              failedStep: { type: 'string' },
              sagaId: { type: 'string' },
            },
          },
        ],
      },
    }),
  );
};
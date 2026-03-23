import { Injectable, ArgumentMetadata, ValidationPipe, ValidationError } from '@nestjs/common';
import { ValidationProblemDetailsException } from '../exceptions/problem-details.exception';

@Injectable()
export class Rfc7807ValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const formattedErrors = this.formatErrors(errors);
        return new ValidationProblemDetailsException(formattedErrors);
      },
    });
  }

  private formatErrors(errors: ValidationError[], parentProperty = ''): any[] {
    const formattedErrors:any = [];

    for (const error of errors) {
      const propertyPath = parentProperty 
        ? `${parentProperty}.${error.property}` 
        : error.property;

      if (error.constraints) {
        // Get the first constraint message
        const [constraintKey, message] = Object.entries(error.constraints)[0];
        
        formattedErrors.push({
          field: propertyPath,
          message,
          rejectedValue: error.value,
          constraint: constraintKey,
        });
      }

      if (error.children?.length) {
        formattedErrors.push(...this.formatErrors(error.children, propertyPath));
      }
    }

    return formattedErrors;
  }
}
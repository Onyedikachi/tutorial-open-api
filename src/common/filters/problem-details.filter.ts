import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ProblemDetailsException } from '../exceptions/problem-details.exception';
import { ProblemDetails } from '../exceptions/problem-details.interface';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate unique instance ID for tracking
    const instance = request.path;
    const traceId = request.headers['x-request-id'] || uuidv4();

    let problemDetails: ProblemDetails;

    // Handle known exception types
    if (exception instanceof ProblemDetailsException) {
      // Already in RFC 7807 format
      const exceptionResponse = exception.getResponse() as any;
      problemDetails = {
        ...exceptionResponse,
        instance,
      };
    } else if (exception instanceof HttpException) {
      // Convert standard NestJS HTTP exception
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      problemDetails = {
        type: 'https://api.openbanking.ng/errors/http-error',
        title: this.getTitleForStatus(status),
        status,
        detail: typeof exceptionResponse === 'string' 
          ? exceptionResponse 
          : exceptionResponse.message || 'An error occurred',
        instance,
        traceId,
        ...(typeof exceptionResponse === 'object' && exceptionResponse),
      };
    } else if (exception instanceof QueryFailedError) {
      // Database errors
      const driverError = exception.driverError;
      
      if (driverError?.code === '23505') { // Unique violation
        problemDetails = {
          type: 'https://api.openbanking.ng/errors/duplicate-resource',
          title: 'Duplicate Resource',
          status: HttpStatus.CONFLICT,
          detail: 'A resource with this identifier already exists',
          instance,
          traceId,
          constraint: driverError.constraint,
          table: driverError.table,
        };
      } else if (driverError?.code === '23503') { // Foreign key violation
        problemDetails = {
          type: 'https://api.openbanking.ng/errors/reference-error',
          title: 'Invalid Reference',
          status: HttpStatus.BAD_REQUEST,
          detail: 'Referenced resource does not exist',
          instance,
          traceId,
          constraint: driverError.constraint,
        };
      } else {
        problemDetails = {
          type: 'https://api.openbanking.ng/errors/database-error',
          title: 'Database Error',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          detail: 'An unexpected database error occurred',
          instance,
          traceId,
        };
      }
    } else if (exception instanceof TokenExpiredError) {
      problemDetails = {
        type: 'https://api.openbanking.ng/errors/token-expired',
        title: 'Token Expired',
        status: HttpStatus.UNAUTHORIZED,
        detail: 'The access token has expired',
        instance,
        traceId,
        expiredAt: exception.expiredAt,
      };
    } else if (exception instanceof JsonWebTokenError) {
      problemDetails = {
        type: 'https://api.openbanking.ng/errors/invalid-token',
        title: 'Invalid Token',
        status: HttpStatus.UNAUTHORIZED,
        detail: exception.message,
        instance,
        traceId,
      };
    } else {
      // Unknown errors
      this.logger.error('Unhandled exception:', exception);
      
      problemDetails = {
        type: 'https://api.openbanking.ng/errors/internal-server-error',
        title: 'Internal Server Error',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'An unexpected error occurred',
        instance,
        traceId,
      };
    }

    // Log error for audit
    this.logger.error({
      message: problemDetails.detail,
      status: problemDetails.status,
      traceId,
      instance,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response
      .status(problemDetails.status)
      .setHeader('Content-Type', 'application/problem+json')
      .json(problemDetails);
  }

  private getTitleForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Unprocessable Entity';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      default:
        return 'HTTP Error';
    }
  }
}
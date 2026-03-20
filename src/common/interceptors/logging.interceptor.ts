import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogger } from '../services/audit-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private auditLogger: AuditLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, client, body } = request;

    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (data) => {
        const responseTime = Date.now() - startTime;
        await this.auditLogger.log({
          action: `${method} ${url}`,
          userId: user?.sub,
          clientId: client?.clientId,
          details: {
            requestBody: body,
            responseData: data,
            responseTime,
            statusCode: context.switchToHttp().getResponse().statusCode,
          },
          timestamp: new Date(),
        });
      }),
    );
  }
}
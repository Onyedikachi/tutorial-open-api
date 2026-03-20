import { 
  Injectable, 
  NestInterceptor, 
  ExecutionContext, 
  CallHandler,
  ConflictException,
  Inject
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { IDEMPOTENCY_KEY } from '../decorators/idempotency.decorator';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const isIdempotent = this.reflector.get<boolean>(
      IDEMPOTENCY_KEY, 
      context.getHandler()
    );

    if (!isIdempotent) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey) {
      throw new ConflictException('Idempotency-Key header required');
    }

    // Check for existing response
    const cachedResponse = await this.cacheManager.get(idempotencyKey);
    if (cachedResponse) {
      return of(cachedResponse);
    }

    // Store the response when complete
    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheManager.set(
          idempotencyKey, 
          response, 
          24 * 60 * 60 * 1000 // 24 hours retention
        );
      })
    );
  }
}
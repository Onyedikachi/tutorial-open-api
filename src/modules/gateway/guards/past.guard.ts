import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PASTGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const client = request.client;

    if (!client || !client.accessRules?.includes('past_access')) {
      throw new ForbiddenException('PAST access not granted');
    }
    return true;
  }
}
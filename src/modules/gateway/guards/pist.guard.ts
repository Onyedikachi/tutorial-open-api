import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PISTGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const client = request.client;

    if (!client || !client.accessRules?.includes('pist_access')) {
      throw new ForbiddenException('PIST access not granted');
    }
    return true;
  }
}
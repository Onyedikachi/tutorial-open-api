import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AccessRuleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const endpointType = this.reflector.get<string>('endpointType', context.getHandler());
    
    const client = request.client;
    const rules = client.accessRules || [];

    // Check specific access rules based on endpoint type
    switch(endpointType) {
      case 'PIST':
        if (!rules.includes('pist_access')) {
          throw new ForbiddenException('PIST access not granted');
        }
        break;
      case 'MIT':
        if (!rules.includes('mit_access')) {
          throw new ForbiddenException('MIT access not granted');
        }
        break;
      // Add other cases
    }

    return true;
  }
}
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('User context missing');
    }
    const orgId = request.headers['x-organization-id'] || request.query['organizationId'];
    if (orgId && orgId !== user.organizationId) {
      throw new ForbiddenException('Tenant mismatch');
    }
    return true;
  }
}

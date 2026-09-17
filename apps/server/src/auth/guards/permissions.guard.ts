import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@lumea/types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { RequestUser } from '../auth.types';
import { permissionsForRole } from '../permissions.map';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user?.adminRole) {
      throw new ForbiddenException('Missing permissions');
    }

    const granted = new Set(permissionsForRole(user.adminRole));
    const ok = required.every((p) => granted.has(p));
    if (!ok) {
      throw new ForbiddenException('Missing permissions');
    }
    return true;
  }
}

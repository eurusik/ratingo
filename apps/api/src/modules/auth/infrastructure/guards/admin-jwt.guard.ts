/**
 * Admin JWT Guard
 *
 * Combines JWT authentication with admin role verification.
 * Use on admin-only endpoints.
 */

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { USER_ROLE } from '../../../users/public';

@Injectable()
export class AdminJwtGuard extends AuthGuard('jwt') implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, run standard JWT authentication
    const isAuthenticated = (await super.canActivate(context)) as boolean;
    if (!isAuthenticated) return false;

    // Then verify admin role
    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string } | undefined;

    if (!user || user.role !== USER_ROLE.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT guard that allows anonymous access; returns null user if unauthenticated.
 * Unlike standard JwtAuthGuard, this guard never throws - it returns null for any auth failure.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Override to suppress all auth errors and return null for unauthenticated requests.
   * Passport passes errors via `err` param OR `info` param depending on the failure type.
   */
  handleRequest<TUser = unknown>(err: unknown, user: TUser, _info: unknown): TUser | null {
    // Any error or missing user means unauthenticated - return null, don't throw
    if (err || !user) {
      return null;
    }
    return user;
  }
}

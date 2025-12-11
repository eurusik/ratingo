import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT guard that allows anonymous access; returns null user if unauthenticated.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: unknown, user: any) {
    if (err) {
      return null;
    }
    return user || null;
  }
}

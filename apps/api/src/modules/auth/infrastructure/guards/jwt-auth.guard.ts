import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT auth guard for protected routes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

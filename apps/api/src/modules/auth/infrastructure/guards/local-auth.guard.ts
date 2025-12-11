import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local auth guard for email/password login.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}

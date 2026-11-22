import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { REVIEW_CONFIG, type ReviewConfig } from '../../../../config/config.constants';

const TOKEN_HEADER = 'x-service-token';

const sameSecret = (provided: string, expected: string): boolean => {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(@Inject(REVIEW_CONFIG) private readonly config: ReviewConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const provided = request.headers[TOKEN_HEADER];
    const expected = this.config.serviceToken;
    if (expected === undefined || typeof provided !== 'string' || !sameSecret(provided, expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

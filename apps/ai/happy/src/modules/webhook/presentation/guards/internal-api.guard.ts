import { createHash, timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { REVIEW_CONFIG, type ReviewConfig } from '../../../../config/config.constants';
import { INTERNAL_PROXY_HEADERS } from '../../domain/constants/webhook.constants';

const BEARER_PREFIX = /^Bearer (\S+)$/;

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

const sameSecret = (provided: string, expected: string): boolean =>
  timingSafeEqual(digest(provided), digest(expected));

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(@Inject(REVIEW_CONFIG) private readonly config: ReviewConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const expected = this.config.serviceToken;
    if (expected === undefined || this.cameThroughPublicProxy(request)) {
      throw new NotFoundException();
    }
    const authorization = request.headers.authorization;
    const provided =
      typeof authorization === 'string' ? BEARER_PREFIX.exec(authorization)?.[1] : undefined;
    if (provided === undefined || !sameSecret(provided, expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }

  private cameThroughPublicProxy(request: FastifyRequest): boolean {
    return INTERNAL_PROXY_HEADERS.some((header) => request.headers[header] !== undefined);
  }
}

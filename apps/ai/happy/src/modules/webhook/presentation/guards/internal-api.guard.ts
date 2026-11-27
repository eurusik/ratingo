import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { InternalAccess, decideInternalAccess } from '@ratingo/ai-core';

import { REVIEW_CONFIG, type ReviewConfig } from '../../../../config/config.constants';

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(@Inject(REVIEW_CONFIG) private readonly config: ReviewConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const access = decideInternalAccess({
      expectedToken: this.config.serviceToken,
      headers: request.headers,
    });
    if (access === InternalAccess.HIDDEN) throw new NotFoundException();
    if (access === InternalAccess.DENIED) throw new UnauthorizedException();
    return true;
  }
}

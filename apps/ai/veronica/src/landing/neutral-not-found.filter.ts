import { Catch, NotFoundException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { NEUTRAL_NOT_FOUND } from '@ratingo/ai-core';

@Catch(NotFoundException)
export class NeutralNotFoundFilter implements ExceptionFilter {
  catch(_exception: NotFoundException, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    reply
      .status(NEUTRAL_NOT_FOUND.status)
      .headers(NEUTRAL_NOT_FOUND.headers)
      .send(NEUTRAL_NOT_FOUND.body);
  }
}

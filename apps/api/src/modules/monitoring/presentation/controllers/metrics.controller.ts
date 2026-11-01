import { Controller, Get, Header, Inject, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { type FastifyReply } from 'fastify';

import {
  KEY_HEALTH_METRICS,
  type KeyHealthMetricsPort,
} from '../../domain/ports/key-health-metrics.port';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(@Inject(KEY_HEALTH_METRICS) private readonly metrics: KeyHealthMetricsPort) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async scrape(@Res() reply: FastifyReply): Promise<void> {
    const body = await this.metrics.expose();
    await reply.header('Content-Type', this.metrics.contentType).send(body);
  }
}

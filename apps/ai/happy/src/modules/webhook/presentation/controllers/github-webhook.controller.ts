import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { WEBHOOK_CONFIG, type WebhookConfig } from '../../../../config/config.constants';
import { WebhookService, type WebhookResult } from '../../application/services/webhook.service';
import { GithubEvent, IgnoreReason } from '../../domain/constants/webhook.constants';
import { verifyWebhookSignature } from '../../infrastructure/security/webhook-signature';
import { parseWebhookEvent } from '../webhook-event.mapper';

const ACCEPTED = 202;

@Controller('webhooks/github')
export class GithubWebhookController {
  private readonly logger = new Logger(GithubWebhookController.name);

  constructor(
    @Inject(WEBHOOK_CONFIG) private readonly config: WebhookConfig,
    private readonly webhooks: WebhookService,
  ) {}

  @Post()
  @HttpCode(ACCEPTED)
  async receive(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') eventName: string | undefined,
  ): Promise<WebhookResult | { status: 'pong' }> {
    const rawBody = request.rawBody;
    if (rawBody === undefined) {
      throw new BadRequestException('Missing request body');
    }
    if (!verifyWebhookSignature(this.config.secret, rawBody, signature)) {
      throw new UnauthorizedException('Invalid signature');
    }
    if (eventName === GithubEvent.PING) {
      return { status: 'pong' };
    }
    const event = parseWebhookEvent(eventName ?? '', this.parseJson(rawBody));
    if (event === null) {
      return { status: 'ignored', reason: IgnoreReason.UNSUPPORTED_EVENT };
    }
    try {
      return await this.webhooks.handle(event);
    } catch (error) {
      this.logger.error(`Could not enqueue webhook: ${error instanceof Error ? error.message : 'unknown'}`);
      throw new ServiceUnavailableException('Review queue unavailable');
    }
  }

  private parseJson(rawBody: Buffer): unknown {
    try {
      return JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Body is not valid JSON');
    }
  }
}

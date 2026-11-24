import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { WEBHOOK_ROUTE, WEBHOOK_ROUTE_PREFIX, WEBHOOK_SECRET_HEADER } from '../chat.constants';
import { ChatWebhookService, WebhookOutcome } from '../application/services/chat-webhook.service';

import { toIncomingMessage } from './telegram-update.schema';

@Controller(WEBHOOK_ROUTE_PREFIX)
export class TelegramWebhookController {
  constructor(private readonly webhook: ChatWebhookService) {}

  @Post(WEBHOOK_ROUTE)
  @HttpCode(HttpStatus.OK)
  async receive(
    @Headers(WEBHOOK_SECRET_HEADER) secretHeader: unknown,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    const outcome = await this.webhook.receive(secretHeader, toIncomingMessage(body));
    if (outcome === WebhookOutcome.REJECTED) {
      throw new UnauthorizedException();
    }
    return { ok: true };
  }
}

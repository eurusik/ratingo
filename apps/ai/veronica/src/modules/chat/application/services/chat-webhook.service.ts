import { Inject, Injectable } from '@nestjs/common';

import {
  CHAT_CONFIG,
  TELEGRAM_CONFIG,
  type ChatConfig,
  type TelegramConfig,
} from '../../../../config/config.constants';
import { ChatOutcome, CommandLabel } from '../../domain/constants/chat.constants';
import type { IncomingMessage } from '../../domain/entities/incoming-message';
import { isAllowed, type Allowlist } from '../../domain/policies/allowlist.policy';
import { CHAT_JOB_QUEUE, type ChatJobQueuePort } from '../../domain/ports/chat-job-queue.port';
import { CHAT_METRICS_PORT, type ChatMetricsPort } from '../../domain/ports/chat-metrics.port';
import {
  WEBHOOK_SECRET_PORT,
  type WebhookSecretPort,
} from '../../domain/ports/webhook-secret.port';

export const WebhookOutcome = {
  REJECTED: 'rejected',
  IGNORED: 'ignored',
  ENQUEUED: 'enqueued',
} as const;
export type WebhookOutcome = (typeof WebhookOutcome)[keyof typeof WebhookOutcome];

@Injectable()
export class ChatWebhookService {
  private readonly allowlist: Allowlist;

  constructor(
    @Inject(WEBHOOK_SECRET_PORT) private readonly secret: WebhookSecretPort,
    @Inject(CHAT_JOB_QUEUE) private readonly queue: ChatJobQueuePort,
    @Inject(CHAT_METRICS_PORT) private readonly metrics: ChatMetricsPort,
    @Inject(CHAT_CONFIG) chat: ChatConfig,
    @Inject(TELEGRAM_CONFIG) telegram: TelegramConfig,
  ) {
    this.allowlist = { userIds: chat.allowedUserIds, chatId: telegram.chatId };
  }

  async receive(secretHeader: unknown, message: IncomingMessage | null): Promise<WebhookOutcome> {
    if (!this.secret.matches(secretHeader)) {
      this.metrics.record({ outcome: ChatOutcome.REJECTED, command: CommandLabel.NONE });
      return WebhookOutcome.REJECTED;
    }
    if (message === null || !isAllowed(message, this.allowlist)) {
      this.metrics.record({ outcome: ChatOutcome.IGNORED, command: CommandLabel.NONE });
      return WebhookOutcome.IGNORED;
    }
    await this.queue.enqueue(message);
    return WebhookOutcome.ENQUEUED;
  }
}

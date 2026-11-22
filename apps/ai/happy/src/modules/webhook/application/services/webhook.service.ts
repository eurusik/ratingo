import { Inject, Injectable, Logger } from '@nestjs/common';

import { REVIEW_CONFIG, type ReviewConfig } from '../../../../config/config.constants';
import { reviewJobId } from '../../../review/public';
import type { IgnoreReason } from '../../domain/constants/webhook.constants';
import type { WebhookEvent } from '../../domain/entities/webhook-event';
import { decideWebhook } from '../../domain/policies/webhook-policy';
import { REVIEW_QUEUE_PORT, type ReviewQueuePort } from '../../domain/ports/review-queue.port';

export type WebhookResult =
  { status: 'queued'; jobId: string } | { status: 'ignored'; reason: IgnoreReason };

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(REVIEW_CONFIG) private readonly config: ReviewConfig,
    @Inject(REVIEW_QUEUE_PORT) private readonly queue: ReviewQueuePort,
  ) {}

  async handle(event: WebhookEvent): Promise<WebhookResult> {
    const decision = decideWebhook(event, this.config);
    if (decision.action === 'ignore') {
      this.logger.log(`Ignored ${event.kind} webhook: ${decision.reason}`);
      return { status: 'ignored', reason: decision.reason };
    }
    await this.queue.enqueue(decision.job);
    const jobId = reviewJobId(decision.job);
    this.logger.log(`Queued ${jobId}`);
    return { status: 'queued', jobId };
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort, type RunTrigger } from '@ratingo/ai-core';

import { NOTIFIER_PORT, type NotifierPort } from '../../../notify/public';
import { CLAIM_STALE_MS } from '../../digest.constants';
import { kyivDateOf } from '../../domain/kyiv-day';
import {
  DIGEST_DELIVERY_REPOSITORY,
  type DigestDeliveryRepository,
} from '../../domain/ports/digest-delivery.repository';

import { DigestComposeService, type ComposedDigest } from './digest-compose.service';

export const DeliveryStatus = {
  SENT: 'sent',
  ALREADY_SENT: 'already-sent',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

@Injectable()
export class DigestDeliveryService {
  private readonly logger = new Logger(DigestDeliveryService.name);

  constructor(
    private readonly composer: DigestComposeService,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(DIGEST_DELIVERY_REPOSITORY)
    private readonly deliveries: DigestDeliveryRepository,
    @Inject(NOTIFIER_PORT) private readonly notifier: NotifierPort,
  ) {}

  async deliver(trigger: RunTrigger): Promise<DeliveryStatus> {
    const date = kyivDateOf(this.clock.nowMs());
    if (!(await this.deliveries.claim(date, this.clock.nowMs(), CLAIM_STALE_MS))) {
      this.logger.log(`Звіт за ${date} уже надіслано або надсилається`);
      return DeliveryStatus.ALREADY_SENT;
    }
    const composed = await this.composeAndSend(date, trigger);
    await this.deliveries.markSent({
      date,
      sentAtMs: this.clock.nowMs(),
      silent: composed.message.silent,
      runId: composed.runId,
    });
    this.logger.log(`Звіт за ${date} надіслано`);
    return DeliveryStatus.SENT;
  }

  private async composeAndSend(date: string, trigger: RunTrigger): Promise<ComposedDigest> {
    try {
      const composed = await this.composer.compose(trigger);
      await this.notifier.send(composed.message);
      return composed;
    } catch (error) {
      await this.deliveries.release(date);
      throw error;
    }
  }
}

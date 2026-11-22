import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import { exchangeRetentionCutoffMs } from '../../domain/policies/exchange-retention.policy';
import {
  CHAT_EXCHANGE_LOG,
  type ChatExchangeLogPort,
} from '../../domain/ports/chat-exchange-log.port';

@Injectable()
export class ChatExchangeRetention {
  private readonly logger = new Logger(ChatExchangeRetention.name);

  constructor(
    @Inject(CHAT_EXCHANGE_LOG) private readonly log: ChatExchangeLogPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async purge(): Promise<number> {
    const deleted = await this.log.deleteOlderThan(exchangeRetentionCutoffMs(this.clock.nowMs()));
    this.logger.log(`Журнал відповідей: прибрано ${deleted} застарілих записів`);
    return deleted;
  }
}

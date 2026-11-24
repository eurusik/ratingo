import { Inject, Injectable } from '@nestjs/common';

import { RunTrigger } from '@ratingo/ai-core';

import { DigestBlock, DigestComposeService } from '../../../digest/public';
import { LAST_EXCHANGES_LIMIT } from '../../domain/constants/exchange.constants';
import { renderLastExchanges } from '../../domain/policies/last-exchanges.policy';
import {
  CHAT_EXCHANGE_LOG,
  type ChatExchangeLogPort,
} from '../../domain/ports/chat-exchange-log.port';
import { ChatCommand } from '../../domain/constants/chat.constants';
import { ON_DEMAND_DIGEST_NOTE } from '../../domain/constants/chat-replies.constants';

import { renderHelp } from './help.reply';

@Injectable()
export class ChatCommandHandlers {
  constructor(
    private readonly digests: DigestComposeService,
    @Inject(CHAT_EXCHANGE_LOG) private readonly exchanges: ChatExchangeLogPort,
  ) {}

  async execute(command: ChatCommand, chatId: string): Promise<string> {
    switch (command) {
      case ChatCommand.HELP:
        return renderHelp();
      case ChatCommand.DIGEST:
        return this.onDemandDigest();
      case ChatCommand.STATUS:
        return (await this.digests.status()).html;
      case ChatCommand.QUEUES:
        return (await this.digests.blocks([DigestBlock.JOBS])).html;
      case ChatCommand.SITE:
        return (await this.digests.blocks([DigestBlock.SITE])).html;
      case ChatCommand.LAST:
        return renderLastExchanges(
          await this.exchanges.recentConversational(chatId, LAST_EXCHANGES_LIMIT),
        );
    }
  }

  private async onDemandDigest(): Promise<string> {
    const { message } = await this.digests.compose(RunTrigger.CHAT);
    return `${ON_DEMAND_DIGEST_NOTE}\n\n${message.html}`;
  }
}

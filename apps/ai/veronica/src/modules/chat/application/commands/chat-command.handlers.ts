import { Injectable } from '@nestjs/common';

import { RunTrigger } from '@ratingo/ai-core';

import { DigestBlock, DigestComposeService } from '../../../digest/public';
import { ChatCommand } from '../../domain/constants/chat.constants';
import { ON_DEMAND_DIGEST_NOTE } from '../../domain/constants/chat-replies.constants';

import { renderHelp } from './help.reply';

@Injectable()
export class ChatCommandHandlers {
  constructor(private readonly digests: DigestComposeService) {}

  async execute(command: ChatCommand): Promise<string> {
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
    }
  }

  private async onDemandDigest(): Promise<string> {
    const { message } = await this.digests.compose(RunTrigger.CHAT);
    return `${ON_DEMAND_DIGEST_NOTE}\n\n${message.html}`;
  }
}

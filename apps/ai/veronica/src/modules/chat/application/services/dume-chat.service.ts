import { Injectable } from '@nestjs/common';

import { ASK_DUME_QUESTION_MAX_CHARS } from '../../domain/constants/dume.constants';
import { DUME_WHY_USAGE } from '../../domain/constants/dume-replies.constants';
import { renderDumeNotice } from '../../domain/policies/dume-message.policy';

import { DumeDelegationService } from './dume-delegation.service';

@Injectable()
export class DumeChatService {
  constructor(private readonly delegation: DumeDelegationService) {}

  async reply(chatId: string, updateId: number, question: string): Promise<string> {
    const text = question.trim().slice(0, ASK_DUME_QUESTION_MAX_CHARS);
    if (text === '') return DUME_WHY_USAGE;
    const outcome = await this.delegation.delegate({ chatId, updateId, question: text });
    return renderDumeNotice(outcome.ownerNotice);
  }
}

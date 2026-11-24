import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import { ChatOutcome, type ChatRoute } from '../../domain/constants/chat.constants';
import { EXCHANGE_TEXT_MAX_CHARS } from '../../domain/constants/exchange.constants';
import type { LoggedToolCall } from '../../domain/entities/chat-exchange';
import { clip } from '../../domain/policies/answer-sanitizer.policy';
import { exchangeOutcomeOf } from '../../domain/policies/exchange-outcome.policy';
import {
  CHAT_EXCHANGE_LOG,
  type ChatExchangeLogPort,
} from '../../domain/ports/chat-exchange-log.port';

export interface ExchangeRecord {
  runId: string | null;
  chatId: string;
  route: ChatRoute;
  question: string;
  answer: string;
  outcome: ChatOutcome;
  cutNumbers?: readonly string[];
  toolNames?: readonly string[];
  toolCalls?: readonly LoggedToolCall[];
}

const failureReason = (error: unknown): string => (error instanceof Error ? error.name : 'error');

@Injectable()
export class ChatExchangeRecorder {
  private readonly logger = new Logger(ChatExchangeRecorder.name);

  constructor(
    @Inject(CHAT_EXCHANGE_LOG) private readonly log: ChatExchangeLogPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async record(record: ExchangeRecord): Promise<void> {
    const outcome = exchangeOutcomeOf(record.outcome);
    if (record.runId === null || outcome === null) return;
    try {
      await this.log.record({
        runId: record.runId,
        chatId: record.chatId,
        createdAtMs: this.clock.nowMs(),
        route: record.route,
        question: clip(record.question, EXCHANGE_TEXT_MAX_CHARS),
        answer: clip(record.answer, EXCHANGE_TEXT_MAX_CHARS),
        outcome,
        cutNumbers: record.cutNumbers ?? [],
        toolNames: record.toolNames ?? [],
        toolCalls: record.toolCalls ?? [],
      });
    } catch (error) {
      this.logger.warn(`Обмін для запуску ${record.runId} не записано: ${failureReason(error)}`);
    }
  }
}

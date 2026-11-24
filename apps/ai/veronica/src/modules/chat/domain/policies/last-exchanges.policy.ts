import { LAST_EXCHANGES_TITLE, NO_EXCHANGES_REPLY } from '../constants/chat-replies.constants';
import {
  COST_DECIMALS,
  ExchangeOutcome,
  LAST_QUESTION_MAX_CHARS,
} from '../constants/exchange.constants';
import type { ChatExchange } from '../entities/chat-exchange';

import { clip, escapeHtml } from './answer-sanitizer.policy';

const OUTCOME_LABELS: Readonly<Record<ExchangeOutcome, string>> = {
  [ExchangeOutcome.ANSWERED]: 'відповіла',
  [ExchangeOutcome.FLAGGED]: 'відповіла, позначила непідтверджені цифри',
  [ExchangeOutcome.REDACTED]: 'прибрала цифри без підтвердження',
  [ExchangeOutcome.FALLBACK]: 'дала запасну відповідь',
  [ExchangeOutcome.FAILED]: 'не вдалося',
};

const renderExchange = (exchange: ChatExchange): string => {
  const flat = exchange.question.replace(/\s+/g, ' ').trim();
  const question = escapeHtml(clip(flat, LAST_QUESTION_MAX_CHARS));
  const cost = `$${exchange.costUsd.toFixed(COST_DECIMALS)}`;
  return `• «${question}» → ${OUTCOME_LABELS[exchange.outcome]}, ${cost}`;
};

export const renderLastExchanges = (exchanges: readonly ChatExchange[]): string =>
  exchanges.length === 0
    ? NO_EXCHANGES_REPLY
    : [LAST_EXCHANGES_TITLE, ...exchanges.map(renderExchange)].join('\n');

import { ChatRoute } from '../constants/chat.constants';
import { ExchangeOutcome } from '../constants/exchange.constants';
import type { ChatExchange, LoggedToolCall } from '../entities/chat-exchange';

import { clip } from './answer-sanitizer.policy';

const REPORT_EXAMPLES_MAX = 20;
const REPORT_QUESTION_MAX_CHARS = 120;
const ANSWER_OUTCOMES: ReadonlySet<string> = new Set([
  ExchangeOutcome.ANSWERED,
  ExchangeOutcome.FLAGGED,
  ExchangeOutcome.REDACTED,
]);

interface FlaggedNumberCount {
  number: string;
  count: number;
}

interface FlaggedExample {
  createdAtMs: number;
  runId: string;
  question: string;
  numbers: readonly string[];
  toolCalls: readonly LoggedToolCall[];
}

export interface FlagsReport {
  sinceMs: number;
  answers: number;
  flaggedAnswers: number;
  numbers: FlaggedNumberCount[];
  examples: FlaggedExample[];
}

const isAnswer = (exchange: ChatExchange): boolean =>
  exchange.route === ChatRoute.INVESTIGATION && ANSWER_OUTCOMES.has(exchange.outcome);

const countNumbers = (flagged: readonly ChatExchange[]): FlaggedNumberCount[] => {
  const counts = new Map<string, number>();
  for (const number of flagged.flatMap((exchange) => exchange.flaggedNumbers)) {
    counts.set(number, (counts.get(number) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([number, count]) => ({ number, count }))
    .sort((left, right) => right.count - left.count || left.number.localeCompare(right.number));
};

export const flagsReportOf = (exchanges: readonly ChatExchange[], sinceMs: number): FlagsReport => {
  const answers = exchanges.filter(isAnswer);
  const flagged = answers.filter((exchange) => exchange.flaggedNumbers.length > 0);
  return {
    sinceMs,
    answers: answers.length,
    flaggedAnswers: flagged.length,
    numbers: countNumbers(flagged),
    examples: [...flagged]
      .sort((left, right) => right.createdAtMs - left.createdAtMs)
      .slice(0, REPORT_EXAMPLES_MAX)
      .map((exchange) => ({
        createdAtMs: exchange.createdAtMs,
        runId: exchange.runId,
        question: clip(exchange.question, REPORT_QUESTION_MAX_CHARS),
        numbers: exchange.flaggedNumbers,
        toolCalls: exchange.toolCalls,
      })),
  };
};

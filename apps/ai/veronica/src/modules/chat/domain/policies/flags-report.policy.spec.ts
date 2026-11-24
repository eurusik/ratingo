import { ChatRoute } from '../constants/chat.constants';
import { ExchangeOutcome } from '../constants/exchange.constants';
import type { ChatExchange } from '../entities/chat-exchange';

import { flagsReportOf } from './flags-report.policy';

const exchange = (overrides: Partial<ChatExchange>): ChatExchange => ({
  id: 'id',
  runId: 'run',
  chatId: '1',
  createdAtMs: 1_000,
  route: ChatRoute.INVESTIGATION,
  question: 'Скільки людей було на сайті?',
  answer: 'Відповідь',
  outcome: ExchangeOutcome.ANSWERED,
  flaggedNumbers: [],
  toolNames: [],
  toolCalls: [],
  costUsd: 0.001,
  ...overrides,
});

describe('flagsReportOf', () => {
  it('counts answers, flagged answers and how often each number was flagged', () => {
    const report = flagsReportOf(
      [
        exchange({ runId: 'a' }),
        exchange({
          runId: 'b',
          outcome: ExchangeOutcome.FLAGGED,
          flaggedNumbers: ['78', '0.503'],
          createdAtMs: 3_000,
        }),
        exchange({
          runId: 'c',
          outcome: ExchangeOutcome.REDACTED,
          flaggedNumbers: ['78'],
          createdAtMs: 2_000,
        }),
        exchange({ runId: 'd', outcome: ExchangeOutcome.FALLBACK }),
        exchange({ runId: 'e', route: ChatRoute.COMMAND }),
      ],
      0,
    );

    expect(report).toMatchObject({
      answers: 3,
      flaggedAnswers: 2,
      numbers: [
        { number: '78', count: 2 },
        { number: '0.503', count: 1 },
      ],
    });
    expect(report.examples.map((example) => example.runId)).toEqual(['b', 'c']);
  });

  it('reports nothing flagged for a quiet period', () => {
    expect(flagsReportOf([], 0)).toEqual({
      sinceMs: 0,
      answers: 0,
      flaggedAnswers: 0,
      numbers: [],
      examples: [],
    });
  });
});

import * as fc from 'fast-check';

import { ChatRoute } from '../constants/chat.constants';
import { ExchangeOutcome } from '../constants/exchange.constants';
import type { ChatExchange } from '../entities/chat-exchange';

import { ExportArgumentError, parseExportArgs, toEvalCaseDraft } from './exchange-export.policy';

const NOW_MS = 1_800_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const exchange: ChatExchange = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  runId: 'run-1',
  chatId: '10',
  createdAtMs: NOW_MS,
  route: ChatRoute.INVESTIGATION,
  question: 'Що з чергами?',
  answer: 'Усе гаразд.',
  outcome: ExchangeOutcome.REDACTED,
  cutNumbers: ['42'],
  toolNames: ['metrics_query'],
  costUsd: 0.01,
};

describe('parseExportArgs', () => {
  it('reads the window in days and hours', () => {
    expect(parseExportArgs(['--since=7d'], NOW_MS).sinceMs).toBe(NOW_MS - 7 * DAY_MS);
    expect(parseExportArgs(['--since=12h'], NOW_MS).sinceMs).toBe(NOW_MS - 12 * 3_600_000);
  });

  it('reads the outcome filter', () => {
    expect(parseExportArgs(['--since=1d', '--outcome=redacted,fallback'], NOW_MS).outcomes).toEqual(
      ['redacted', 'fallback'],
    );
    expect(parseExportArgs(['--since=1d'], NOW_MS).outcomes).toEqual([]);
  });

  it.each([[[]], [['--since=week']], [['--since=7']], [['--since=1d', '--outcome=bogus']]])(
    'rejects %j',
    (args) => {
      expect(() => parseExportArgs(args, NOW_MS)).toThrow(ExportArgumentError);
    },
  );

  it('always looks back by the requested amount', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), (days) => {
        expect(NOW_MS - parseExportArgs([`--since=${days}d`], NOW_MS).sinceMs).toBe(days * DAY_MS);
      }),
    );
  });
});

describe('toEvalCaseDraft', () => {
  it('shapes an exchange as an eval case draft without raw payloads', () => {
    const draft = toEvalCaseDraft(exchange);
    expect(draft).toMatchObject({
      id: 'draft-abcdef12',
      question: 'Що з чергами?',
      expectedTools: ['metrics_query'],
      reference: { answer: 'Усе гаразд.' },
      fixtures: [],
      mustContain: [],
      observed: { outcome: 'redacted', cutNumbers: ['42'], runId: 'run-1' },
    });
    expect(JSON.stringify(draft)).not.toContain('input');
  });
});

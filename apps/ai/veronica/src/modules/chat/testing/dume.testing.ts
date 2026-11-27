import {
  DumeFailureReason,
  DumeState,
  DumeSupport,
  type DumeRequestView,
  type DumeResult,
} from '../domain/entities/dume';

export const COMMIT = 'a'.repeat(40);
export const NOW_MS = Date.UTC(2026, 10, 27, 12, 0, 0);

export const dumeResult = (overrides: Partial<DumeResult['answer']> = {}): DumeResult => ({
  repository: 'eurusik/ratingo',
  ref: 'main',
  commit: COMMIT,
  turns: 7,
  costUsd: 0.083,
  answer: {
    answer: 'The timeout is set to 10 seconds in the TMDB client.',
    facts: [
      {
        text: 'The client passes a 10 second timeout to every request.',
        citations: [{ path: 'apps/api/src/tmdb/tmdb.client.ts', startLine: 10, endLine: 14 }],
        evidence: [],
      },
      {
        text: 'The worker logged TMDB timeouts today.',
        citations: [],
        evidence: [
          { ref: 'logs_search#2.1', tool: 'logs_search', summary: 'TMDB API: Request timeout' },
        ],
      },
    ],
    assumptions: [
      {
        text: 'The provider may be slow during the morning import.',
        origin: 'stated_by_model',
        problems: [],
      },
      {
        text: 'The retry policy hides most of the timeouts.',
        origin: 'unverified_claim',
        problems: [{ failure: 'not_read_in_this_run' }],
      },
    ],
    unknowns: ['Whether the provider changed its limits this week.'],
    support: DumeSupport.PARTLY_SUPPORTED,
    ...overrides,
  },
});

export const answeredView = (overrides: Partial<DumeRequestView> = {}): DumeRequestView => ({
  requestId: 'tg1000001',
  state: DumeState.ANSWERED,
  createdAtMs: NOW_MS - 60_000,
  startedAtMs: NOW_MS - 50_000,
  finishedAtMs: NOW_MS - 1_000,
  result: dumeResult(),
  ...overrides,
});

export const failedView = (reason: DumeFailureReason): DumeRequestView => ({
  requestId: 'tg1000001',
  state: DumeState.FAILED,
  reason,
  createdAtMs: NOW_MS - 60_000,
  finishedAtMs: NOW_MS - 1_000,
});

export const queuedView = (overrides: Partial<DumeRequestView> = {}): DumeRequestView => ({
  requestId: 'tg1000001',
  state: DumeState.QUEUED,
  createdAtMs: NOW_MS - 60_000,
  ...overrides,
});

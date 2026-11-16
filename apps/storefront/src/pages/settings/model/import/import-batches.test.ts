import type { ImportBatch } from '@/shared/api';
import { batchOutcome, isAnyRunning, runningProgress } from './import-batches';

function batch(overrides: Partial<ImportBatch>): ImportBatch {
  return {
    batchId: 'b1',
    source: 'imdb',
    totalItems: 10,
    completedCount: 0,
    failedCount: 0,
    status: 'processing',
    createdAt: '2026-11-16T10:00:00Z',
    ...overrides,
  };
}

describe('runningProgress', () => {
  it('is empty when nothing is processing', () => {
    expect(runningProgress(undefined)).toBeUndefined();
    expect(runningProgress([batch({ status: 'completed' })])).toBeUndefined();
  });

  it('adds up processed items across running batches and names the newest source', () => {
    expect(
      runningProgress([
        batch({ batchId: 'a', completedCount: 3, failedCount: 1 }),
        batch({
          batchId: 'b',
          source: 'tmdb',
          totalItems: 2,
          completedCount: 1,
          createdAt: '2026-11-16T11:00:00Z',
        }),
        batch({ batchId: 'c', status: 'cancelled', totalItems: 50 }),
      ]),
    ).toEqual({ source: 'tmdb', done: 5, total: 12, batchIds: ['a', 'b'] });
  });
});

describe('batchOutcome', () => {
  it('treats a missing or processing batch as running', () => {
    expect(batchOutcome(undefined)).toBe('running');
    expect(batchOutcome(batch({}))).toBe('running');
    expect(batchOutcome(batch({ status: 'cancelled' }))).toBe('cancelled');
  });
});

describe('isAnyRunning', () => {
  it('is true while one batch processes', () => {
    expect(isAnyRunning([batch({ status: 'completed' }), batch({})])).toBe(true);
    expect(isAnyRunning([])).toBe(false);
  });
});

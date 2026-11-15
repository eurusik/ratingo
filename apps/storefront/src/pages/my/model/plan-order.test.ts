import fc from 'fast-check';
import type { SavedItem } from '@/shared/api';
import { PLAN_SORTS, TYPE_FILTERS, mergeSaved, orderPlan } from './plan-order';

const NOW = Date.parse('2026-11-15T12:00:00Z');

function saved(id: string, overrides: Partial<SavedItem> = {}, summary = {}): SavedItem {
  return {
    id: `saved-${id}`,
    mediaItemId: id,
    list: 'for_later',
    reasonKey: null,
    createdAt: '2026-11-01T00:00:00Z',
    activeSubscriptionTriggers: [],
    mediaSummary: { id, type: 'movie', title: id, slug: id, poster: null, ...summary },
    ...overrides,
  };
}

const savedArbitrary = fc
  .record({
    id: fc.constantFrom('a', 'b', 'c', 'd', 'e'),
    type: fc.constantFrom('movie' as const, 'show' as const),
    day: fc.integer({ min: 1, max: 28 }),
    score: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  })
  .map(({ id, type, day, score }) =>
    saved(
      id,
      { createdAt: `2026-10-${String(day).padStart(2, '0')}T00:00:00Z` },
      { type, qualityScore: score },
    ),
  );

describe('plan order', () => {
  it('keeps each title once even when it is in both saved lists', () => {
    fc.assert(
      fc.property(fc.array(savedArbitrary), fc.array(savedArbitrary), (forLater, considering) => {
        const ids = mergeSaved(forLater, considering).map((row) => row.title.mediaItemId);
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(ids)).toEqual(
          new Set([...forLater, ...considering].map((item) => item.mediaItemId)),
        );
      }),
    );
  });

  it('never loses or invents rows when sorting and filtering', () => {
    fc.assert(
      fc.property(
        fc.array(savedArbitrary),
        fc.constantFrom(...PLAN_SORTS),
        fc.constantFrom(...TYPE_FILTERS),
        (items, sort, filter) => {
          const rows = mergeSaved(items);
          const ordered = orderPlan(rows, { sort, filter, now: NOW });
          const expected = rows.filter((row) => filter === 'all' || row.title.type === filter);
          expect(ordered).toHaveLength(expected.length);
        },
      ),
    );
  });

  it('puts upcoming releases first, soonest first', () => {
    const rows = mergeSaved([
      saved('old', {}, { releaseDate: '2020-01-01' }),
      saved('later', {}, { releaseDate: '2027-05-01' }),
      saved('soon', {}, { releaseDate: '2026-12-01' }),
    ]);
    const ordered = orderPlan(rows, { sort: 'releaseDate', filter: 'all', now: NOW });
    expect(ordered.map((row) => row.title.mediaItemId)).toEqual(['soon', 'later', 'old']);
  });

  it('sorts by quality score with unrated titles last', () => {
    const rows = mergeSaved([
      saved('none'),
      saved('high', {}, { qualityScore: 84 }),
      saved('low', {}, { qualityScore: 61 }),
    ]);
    const ordered = orderPlan(rows, { sort: 'rating', filter: 'all', now: NOW });
    expect(ordered.map((row) => row.title.mediaItemId)).toEqual(['high', 'low', 'none']);
  });
});

import fc from 'fast-check';
import type { LibraryCounts } from '@/shared/api';
import { LIBRARY_LISTS, applyMove, isMainLibraryList, listCount } from './library-lists';

const countsArbitrary: fc.Arbitrary<LibraryCounts> = fc.record({
  watching: fc.nat(500),
  paused: fc.nat(500),
  dropped: fc.nat(500),
  completed: fc.nat(500),
  caughtUp: fc.nat(500),
  forLater: fc.nat(500),
  considering: fc.nat(500),
});

const listArbitrary = fc.constantFrom(...LIBRARY_LISTS);

describe('library lists', () => {
  it('moves exactly one title from one list to another', () => {
    fc.assert(
      fc.property(countsArbitrary, listArbitrary, listArbitrary, (counts, from, to) => {
        fc.pre(from !== to && listCount(counts, from) > 0);
        const moved = applyMove(counts, { from, to });
        expect(listCount(moved, from)).toBe(listCount(counts, from) - 1);
        expect(listCount(moved, to)).toBe(listCount(counts, to) + 1);
      }),
    );
  });

  it('never drops a count below zero', () => {
    fc.assert(
      fc.property(countsArbitrary, listArbitrary, (counts, from) => {
        const moved = applyMove(counts, { from });
        Object.values(moved).forEach((count) => expect(count).toBeGreaterThanOrEqual(0));
      }),
    );
  });

  it('adds both saved lists and the caught-up shows to the visible totals', () => {
    const counts = {
      watching: 3,
      paused: 1,
      dropped: 2,
      completed: 9,
      caughtUp: 4,
      forLater: 5,
      considering: 6,
    };
    expect(listCount(counts, 'watching')).toBe(7);
    expect(listCount(counts, 'plan')).toBe(11);
  });

  it('accepts only the main list names', () => {
    expect(isMainLibraryList('plan')).toBe(true);
    expect(isMainLibraryList('paused')).toBe(false);
    expect(isMainLibraryList('saved')).toBe(false);
    expect(isMainLibraryList(null)).toBe(false);
  });
});

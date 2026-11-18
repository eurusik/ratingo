import fc from 'fast-check';
import { activeList, startRail } from './rail-start';

describe('startRail', () => {
  const ORDER = ['show', 'movie'] as const;
  const counts = fc.record({ show: fc.nat({ max: 3 }), movie: fc.nat({ max: 3 }) });

  it('ships only the first list that has titles and names every list that has some', () => {
    fc.assert(
      fc.property(counts, (sizes) => {
        const lists = { show: Array(sizes.show).fill('s'), movie: Array(sizes.movie).fill('m') };
        const { available, first } = startRail(lists, ORDER);

        expect(available).toEqual(ORDER.filter((key) => sizes[key] > 0));
        expect(first?.list).toBe(available[0]);
        if (first) expect(first.items).toBe(lists[first.list]);
      }),
    );
  });

  it('has nothing to show when every list is empty', () => {
    expect(startRail({ show: [], movie: [] }, ORDER)).toEqual({ available: [], first: undefined });
  });
});

describe('activeList', () => {
  const ORDER = ['show', 'movie'] as const;

  it('keeps the chosen list while it has titles and otherwise falls back to the first one that does', () => {
    fc.assert(
      fc.property(
        fc.subarray([...ORDER]),
        fc.option(fc.constantFrom(...ORDER), { nil: undefined }),
        (available, chosen) => {
          const active = activeList(available, chosen);

          if (chosen !== undefined && available.includes(chosen)) expect(active).toBe(chosen);
          else expect(active).toBe(available[0]);
        },
      ),
    );
  });
});

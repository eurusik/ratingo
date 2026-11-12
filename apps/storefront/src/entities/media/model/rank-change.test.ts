import fc from 'fast-check';
import { rankChange } from './rank-change';

const rank = fc.integer({ min: 1, max: 500 });

describe('rankChange', () => {
  it('marks a title without a previous rank as new', () => {
    fc.assert(
      fc.property(rank, (current) => expect(rankChange(current, null)).toEqual({ kind: 'new' })),
    );
  });

  it('moves up by the places gained and down by the places lost', () => {
    expect(rankChange(2, 5)).toEqual({ kind: 'up', places: 3 });
    expect(rankChange(7, 4)).toEqual({ kind: 'down', places: 3 });
    expect(rankChange(3, 3)).toEqual({ kind: 'same' });
  });

  it('always reports the exact distance between the two ranks', () => {
    fc.assert(
      fc.property(rank, rank, (current, previous) => {
        const move = rankChange(current, previous);
        const places = 'places' in move ? move.places : 0;
        expect(places).toBe(Math.abs(previous - current));
        expect(places === 0).toBe(move.kind === 'same');
      }),
    );
  });
});

import fc from 'fast-check';
import { interleave } from './interleave';

describe('interleave', () => {
  it('alternates two lists and keeps every item once', () => {
    expect(interleave([1, 3, 5], [2, 4])).toEqual([1, 2, 3, 4, 5]);
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.array(fc.integer()), (first, second) => {
        const mixed = interleave(first, second);
        expect(mixed).toHaveLength(first.length + second.length);
        expect([...mixed].sort()).toEqual([...first, ...second].sort());
      }),
    );
  });
});

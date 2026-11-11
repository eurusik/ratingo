import fc from 'fast-check';
import { withOccurrenceKeys } from '../occurrence-keys';

describe('withOccurrenceKeys', () => {
  it('keeps items in order and gives every item a unique key', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('a', 'b', 'c', '')), (items) => {
        const keyed = withOccurrenceKeys(items, (item) => item);
        expect(keyed.map(({ item }) => item)).toEqual(items);
        expect(new Set(keyed.map(({ key }) => key)).size).toBe(items.length);
      }),
    );
  });

  it('keeps the key of an item stable when later duplicates are appended', () => {
    const first = withOccurrenceKeys(['tt1', 'tt2'], (id) => id);
    const extended = withOccurrenceKeys(['tt1', 'tt2', 'tt1'], (id) => id);
    expect(extended.slice(0, 2)).toEqual(first);
    expect(extended[2].key).toBe('tt1#1');
  });
});

import { withOccurrenceKeys } from './occurrence-keys';

describe('withOccurrenceKeys', () => {
  it('numbers repeated keys so every key stays unique', () => {
    const keys = withOccurrenceKeys(['a', 'b', 'a', 'a'], (item) => item).map(({ key }) => key);
    expect(keys).toEqual(['a', 'b', 'a#1', 'a#2']);
  });
});

import { createIdSet } from './hidden-reviews';

describe('createIdSet', () => {
  it('notifies only on real changes', () => {
    const set = createIdSet();
    const listener = jest.fn();
    set.subscribe(listener);

    set.add('a');
    set.add('a');
    set.remove('b');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(set.read().has('a')).toBe(true);

    set.remove('a');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(set.read().size).toBe(0);
  });
});

import { isGenericTitle } from '../episode.utils';

describe('isGenericTitle', () => {
  it.each(['Episode 5', 'Серія 12', 'TBA', 'TBD', '', '  '])('treats %s as generic', (title) => {
    expect(isGenericTitle(title)).toBe(true);
  });

  it('treats a missing title as generic', () => {
    expect(isGenericTitle(null)).toBe(true);
  });

  it('keeps a real episode title', () => {
    expect(isGenericTitle('Heavy Is the Crown')).toBe(false);
  });
});

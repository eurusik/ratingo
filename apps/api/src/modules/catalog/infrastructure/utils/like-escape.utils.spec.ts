import { escapeLikePattern } from './like-escape.utils';

describe('escapeLikePattern', () => {
  it('leaves plain text untouched', () => {
    expect(escapeLikePattern('Breaking Bad')).toBe('Breaking Bad');
    expect(escapeLikePattern('Кіборги')).toBe('Кіборги');
  });

  it('escapes % and _ wildcards', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
  });

  it('escapes backslashes first so they cannot neutralise other escapes', () => {
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
    expect(escapeLikePattern('\\%')).toBe('\\\\\\%');
  });
});

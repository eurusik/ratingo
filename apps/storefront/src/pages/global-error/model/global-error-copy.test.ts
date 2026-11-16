import { globalErrorLocale } from './global-error-copy';

describe('globalErrorLocale', () => {
  it('follows the language the visitor picked on the site', () => {
    expect(globalErrorLocale('theme=dark; ratingo-locale=en', 'uk-UA')).toBe('en');
    expect(globalErrorLocale('ratingo-locale=uk', 'en-US')).toBe('uk');
  });

  it.each([
    ['en-US', 'en'],
    ['EN', 'en'],
    ['uk-UA', 'uk'],
    ['pl-PL', 'uk'],
    [undefined, 'uk'],
  ])('falls back to the browser language %s → %s', (language, expected) => {
    expect(globalErrorLocale('', language)).toBe(expected);
  });
});

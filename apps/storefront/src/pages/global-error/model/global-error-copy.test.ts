import { globalErrorLocale } from './global-error-copy';

describe('globalErrorLocale', () => {
  it.each([
    ['en-US', 'en'],
    ['EN', 'en'],
    ['uk-UA', 'uk'],
    ['pl-PL', 'uk'],
    [undefined, 'uk'],
  ])('picks %s → %s', (language, expected) => {
    expect(globalErrorLocale(language)).toBe(expected);
  });
});

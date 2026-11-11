import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { createI18n } from '../i18n-context';

const ukDictionary = { greeting: { hello: 'Привіт' } };
const enDictionary = { greeting: { hello: 'Hello' } };

const { I18nProvider, useTranslation, useLocale } = createI18n<typeof ukDictionary>();

function wrapperFor(locale: 'uk' | 'en', dictionary: typeof ukDictionary) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider locale={locale} dictionary={dictionary}>
        {children}
      </I18nProvider>
    );
  };
}

describe('createI18n', () => {
  it('exposes the dictionary and locale handed to the provider', () => {
    const { result } = renderHook(() => ({ i18n: useTranslation(), locale: useLocale() }), {
      wrapper: wrapperFor('en', enDictionary),
    });

    expect(result.current.i18n.dict).toBe(enDictionary);
    expect(result.current.locale).toBe('en');
    expect(result.current.i18n.t('greeting.hello')).toBe('Hello');
  });

  it('falls back to the path for a missing key', () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperFor('uk', ukDictionary),
    });

    expect(result.current.t('greeting.missing')).toBe('greeting.missing');
  });

  it('switches strings when the provider gets another dictionary', () => {
    let dictionary = ukDictionary;
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <I18nProvider locale="uk" dictionary={dictionary}>
          {children}
        </I18nProvider>
      );
    }
    const { result, rerender } = renderHook(() => useTranslation(), { wrapper: Wrapper });
    expect(result.current.t('greeting.hello')).toBe('Привіт');

    dictionary = enDictionary;
    rerender();

    expect(result.current.t('greeting.hello')).toBe('Hello');
  });

  it('throws outside the provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useTranslation())).toThrow(
      'useTranslation must be used within I18nProvider',
    );
  });
});

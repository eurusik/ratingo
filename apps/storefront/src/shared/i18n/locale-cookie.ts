import { DEFAULT_LOCALE, type Locale } from '@ratingo/web-core/i18n';

export const LOCALE_COOKIE = 'ratingo-locale';

const SUPPORTED_LOCALES: readonly Locale[] = ['uk', 'en'];
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function toLocale(value: string | undefined): Locale {
  return SUPPORTED_LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
}

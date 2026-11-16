import { LOCALE_COOKIE, toLocale } from '@/shared/i18n';

type GlobalErrorLocale = 'uk' | 'en';

interface GlobalErrorCopy {
  title: string;
  text: string;
  reload: string;
  errorCode: string;
}

export const GLOBAL_ERROR_COPY: Record<GlobalErrorLocale, GlobalErrorCopy> = {
  uk: {
    title: 'Ratingo не завантажився',
    text: 'Щось зламалось ще до того, як сторінка відкрилась. Оновлення зазвичай допомагає.',
    reload: 'Оновити сторінку',
    errorCode: 'Код помилки:',
  },
  en: {
    title: 'Ratingo didn’t load',
    text: 'Something broke before the page could open. Reloading usually helps.',
    reload: 'Reload the page',
    errorCode: 'Error code:',
  },
};

function chosenLocale(cookies: string): string | undefined {
  return cookies
    .split(';')
    .map((cookie) => cookie.trim().split('='))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
}

export function globalErrorLocale(cookies: string, browserLanguage?: string): GlobalErrorLocale {
  const chosen = chosenLocale(cookies);
  if (chosen) return toLocale(chosen);
  return browserLanguage?.toLowerCase().startsWith('en') ? 'en' : 'uk';
}

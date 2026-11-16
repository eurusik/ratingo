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

export function globalErrorLocale(browserLanguage: string | undefined): GlobalErrorLocale {
  return browserLanguage?.toLowerCase().startsWith('en') ? 'en' : 'uk';
}

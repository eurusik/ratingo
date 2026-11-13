'use client';

import { useRouter } from 'next/navigation';
import type { Locale } from '@ratingo/web-core/i18n';
import { localeCookie } from './locale-cookie';

export function useChangeLocale(): (locale: Locale) => void {
  const router = useRouter();

  return (locale) => {
    document.cookie = localeCookie(locale);
    router.refresh();
  };
}

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, toLocale, type Locale } from '@/shared/i18n';

export async function getRequestLocale(): Promise<Locale> {
  const store = await cookies();
  return toLocale(store.get(LOCALE_COOKIE)?.value);
}

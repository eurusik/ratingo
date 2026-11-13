import type { Metadata } from 'next';
import { MyPage } from '@/pages/my';
import { DEFAULT_LOCALE, getDictionary } from '@/shared/i18n';

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = { title: dict.nav.my };

export default function MyRoute() {
  return <MyPage locale={DEFAULT_LOCALE} />;
}

import type { Metadata } from 'next';
import { OfflinePage } from '@/pages/offline';
import { DEFAULT_LOCALE, getDictionary } from '@/shared/i18n';

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = { title: dict.offline.title };

export default function OfflineRoute() {
  return <OfflinePage locale={DEFAULT_LOCALE} />;
}

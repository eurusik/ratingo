import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { OfflinePage } from '@/pages/offline';
import { TranslationScope, getDictionary } from '@/shared/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getRequestLocale());

  return { title: dict.offline.title, robots: { index: false, follow: false } };
}

export default async function OfflineRoute() {
  return (
    <TranslationScope locale={await getRequestLocale()} namespaces={['offline']}>
      <OfflinePage />
    </TranslationScope>
  );
}

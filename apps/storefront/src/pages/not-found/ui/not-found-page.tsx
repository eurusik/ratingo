import { Suspense } from 'react';
import type { Locale } from '@/shared/i18n';
import { NotFoundContent } from './not-found-content';
import { WatchedNow, WatchedNowSkeleton } from './watched-now';

export function NotFoundPage({ locale }: { locale: Locale }) {
  return (
    <NotFoundContent
      watchedNow={
        <Suspense fallback={<WatchedNowSkeleton locale={locale} />}>
          <WatchedNow locale={locale} />
        </Suspense>
      }
    />
  );
}

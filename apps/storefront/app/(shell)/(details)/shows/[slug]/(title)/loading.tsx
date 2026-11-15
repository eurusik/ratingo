import { getRequestLocale, getTrackingHints } from '@/app/entrypoint';
import { DetailsSkeleton } from '@/pages/media-details';
import { getDictionary } from '@/shared/i18n';

export default async function ShowDetailsLoading() {
  const [locale, trackingHints] = await Promise.all([getRequestLocale(), getTrackingHints()]);
  return (
    <DetailsSkeleton
      label={getDictionary(locale).common.loading}
      type="show"
      trackingHints={trackingHints}
    />
  );
}

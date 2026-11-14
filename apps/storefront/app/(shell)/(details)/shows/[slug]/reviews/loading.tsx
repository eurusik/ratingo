import { getRequestLocale } from '@/app/entrypoint';
import { ReviewsPageSkeleton } from '@/pages/media-reviews';
import { getDictionary } from '@/shared/i18n';

export default async function ReviewsLoading() {
  const dict = getDictionary(await getRequestLocale());
  return <ReviewsPageSkeleton label={dict.common.loading} />;
}

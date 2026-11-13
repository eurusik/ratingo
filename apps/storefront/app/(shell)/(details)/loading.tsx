import { getRequestLocale } from '@/app/entrypoint';
import { DetailsSkeleton } from '@/pages/media-details';
import { getDictionary } from '@/shared/i18n';

export default async function DetailsLoading() {
  const dict = getDictionary(await getRequestLocale());
  return <DetailsSkeleton label={dict.common.loading} />;
}

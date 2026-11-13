import { getRequestLocale } from '@/app/entrypoint';
import { BrowseSkeleton } from '@/pages/browse';
import { getDictionary } from '@/shared/i18n';

export default async function BrowseLoading() {
  const dict = getDictionary(await getRequestLocale());
  return <BrowseSkeleton label={dict.common.loading} />;
}

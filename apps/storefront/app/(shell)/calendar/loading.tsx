import { getRequestLocale } from '@/app/entrypoint';
import { CalendarPageSkeleton } from '@/pages/calendar';
import { getDictionary } from '@/shared/i18n';

export default async function CalendarLoading() {
  const dict = getDictionary(await getRequestLocale());
  return <CalendarPageSkeleton label={dict.common.loading} />;
}

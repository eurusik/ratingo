import type { Metadata } from 'next';
import type { CalendarMediaType } from '@/shared/api';
import { BRAND_NAME, calendarRouteFor } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';
import { buildOpenGraph } from '@/shared/lib';

export function calendarMetadata(locale: Locale, type: CalendarMediaType): Metadata {
  const { metaTitle: title, metaDescription: description } = getDictionary(locale).calendar;
  const canonical = calendarRouteFor(type);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: buildOpenGraph({
      locale,
      title: `${title} | ${BRAND_NAME}`,
      description,
      url: canonical,
    }),
  };
}

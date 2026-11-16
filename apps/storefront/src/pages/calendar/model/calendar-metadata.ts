import type { Metadata } from 'next';
import { BRAND_NAME, CALENDAR_ROUTE } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';
import { DEFAULT_SHARE_IMAGE } from '@/shared/lib';

export function calendarMetadata(locale: Locale): Metadata {
  const { metaTitle: title, metaDescription: description } = getDictionary(locale).calendar;

  return {
    title,
    description,
    alternates: { canonical: CALENDAR_ROUTE },
    openGraph: { title: `${title} | ${BRAND_NAME}`, description, images: [DEFAULT_SHARE_IMAGE] },
  };
}

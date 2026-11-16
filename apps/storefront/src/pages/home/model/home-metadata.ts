import type { Metadata } from 'next';
import { HOME_ROUTE } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';
import { buildOpenGraph } from '@/shared/lib';

export function homeMetadata(locale: Locale): Metadata {
  const { title, description } = getDictionary(locale).meta;

  return {
    alternates: { canonical: HOME_ROUTE },
    openGraph: buildOpenGraph({ locale, title, description, url: HOME_ROUTE }),
  };
}

import type { Metadata } from 'next';
import { BRAND_NAME } from '@/shared/config';
import type { Locale } from '@/shared/i18n';
import { DEFAULT_SHARE_IMAGE } from './share-image';

const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  uk: 'uk_UA',
  en: 'en_US',
};

interface OpenGraphOptions {
  locale: Locale;
  title?: string;
  description?: string;
  url?: string;
}

export function buildOpenGraph({
  locale,
  title,
  description,
  url,
}: OpenGraphOptions): NonNullable<Metadata['openGraph']> {
  return {
    type: 'website',
    siteName: BRAND_NAME,
    locale: OPEN_GRAPH_LOCALES[locale],
    images: [DEFAULT_SHARE_IMAGE],
    ...(title && { title }),
    ...(description && { description }),
    ...(url && { url }),
  };
}

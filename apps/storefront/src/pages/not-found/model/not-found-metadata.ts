import type { Metadata } from 'next';
import { getDictionary, type Locale } from '@/shared/i18n';

export function notFoundMetadata(locale: Locale): Metadata {
  return {
    title: getDictionary(locale).notFound.metaTitle,
    robots: { index: false, follow: true },
  };
}

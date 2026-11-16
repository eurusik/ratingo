import type { Metadata } from 'next';
import { getDictionary, type Locale } from '@/shared/i18n';

export function myMetadata(locale: Locale): Metadata {
  return { title: getDictionary(locale).nav.my, robots: { index: false } };
}

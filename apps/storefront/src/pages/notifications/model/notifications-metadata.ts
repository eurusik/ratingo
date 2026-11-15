import type { Metadata } from 'next';
import { getDictionary, type Locale } from '@/shared/i18n';

export function notificationsMetadata(locale: Locale): Metadata {
  return { title: getDictionary(locale).notifications.title, robots: { index: false } };
}

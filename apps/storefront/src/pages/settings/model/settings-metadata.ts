import type { Metadata } from 'next';
import { getDictionary, type Locale } from '@/shared/i18n';
import type { SettingsSection } from './settings-sections';

export function settingsMetadata(locale: Locale, section?: SettingsSection): Metadata {
  const { settings } = getDictionary(locale);
  const title = section ? `${settings.sections[section]} · ${settings.title}` : settings.title;
  return { title, robots: { index: false } };
}

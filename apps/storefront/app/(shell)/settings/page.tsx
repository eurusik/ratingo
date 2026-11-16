import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { SettingsHomePage, settingsMetadata } from '@/pages/settings';

export async function generateMetadata(): Promise<Metadata> {
  return settingsMetadata(await getRequestLocale());
}

export default function SettingsRoute() {
  return <SettingsHomePage />;
}

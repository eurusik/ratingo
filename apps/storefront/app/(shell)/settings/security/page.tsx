import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { SecuritySettingsPage, settingsMetadata } from '@/pages/settings';

export async function generateMetadata(): Promise<Metadata> {
  return settingsMetadata(await getRequestLocale(), 'security');
}

export default function SecuritySettingsRoute() {
  return <SecuritySettingsPage />;
}

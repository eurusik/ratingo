import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { ImportSettingsPage, settingsMetadata } from '@/pages/settings';

export async function generateMetadata(): Promise<Metadata> {
  return settingsMetadata(await getRequestLocale(), 'import');
}

export default function ImportSettingsRoute() {
  return <ImportSettingsPage />;
}

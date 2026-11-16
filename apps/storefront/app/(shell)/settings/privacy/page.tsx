import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { PrivacySettingsPage, settingsMetadata } from '@/pages/settings';

export async function generateMetadata(): Promise<Metadata> {
  return settingsMetadata(await getRequestLocale(), 'privacy');
}

export default function PrivacySettingsRoute() {
  return <PrivacySettingsPage />;
}

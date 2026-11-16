import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { ProfileSettingsPage, settingsMetadata } from '@/pages/settings';

export async function generateMetadata(): Promise<Metadata> {
  return settingsMetadata(await getRequestLocale(), 'profile');
}

export default function ProfileSettingsRoute() {
  return <ProfileSettingsPage />;
}

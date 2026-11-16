import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { NotificationSettingsPage, settingsMetadata } from '@/pages/settings';

export async function generateMetadata(): Promise<Metadata> {
  return settingsMetadata(await getRequestLocale(), 'notifications');
}

export default function NotificationSettingsRoute() {
  return <NotificationSettingsPage />;
}

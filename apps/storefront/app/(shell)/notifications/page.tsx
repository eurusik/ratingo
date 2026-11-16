import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { NotificationsPage, notificationsMetadata } from '@/pages/notifications';

export async function generateMetadata(): Promise<Metadata> {
  return notificationsMetadata(await getRequestLocale());
}

export default function NotificationsRoute() {
  return <NotificationsPage />;
}

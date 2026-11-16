import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getRequestLocale } from '@/app/entrypoint';
import { CalendarPage, calendarMetadata } from '@/pages/calendar';

export async function generateMetadata(): Promise<Metadata> {
  return calendarMetadata(await getRequestLocale());
}

export default async function CalendarRoute() {
  await connection();
  return <CalendarPage />;
}

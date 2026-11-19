import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getRequestLocale } from '@/app/entrypoint';
import {
  CalendarPage,
  calendarMetadata,
  parseCalendarType,
  type CalendarSearchParams,
} from '@/pages/calendar';

interface CalendarRouteProps {
  searchParams: Promise<CalendarSearchParams>;
}

export async function generateMetadata({ searchParams }: CalendarRouteProps): Promise<Metadata> {
  const [locale, { type }] = await Promise.all([getRequestLocale(), searchParams]);
  return calendarMetadata(locale, parseCalendarType(type));
}

export default async function CalendarRoute() {
  await connection();
  return <CalendarPage />;
}

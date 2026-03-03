/**
 * Calendar page — Server Component.
 *
 * Pre-fetches the current week's calendar on the server so the first paint is
 * populated. The client orchestrator takes over for week navigation.
 *
 * Dynamic: reads a cookie to determine the user's preferred calendar mode so
 * the SSR output matches the client state without a flash.
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getDictionary } from '@/shared/i18n';
import { catalogApi } from '@/core/api';
import { CalendarPageClient } from '@/modules/calendar';

const dict = getDictionary('uk');

export const metadata: Metadata = {
  title: dict.calendar.title,
  description: dict.calendar.description,
};

/** Formats current date as YYYY-MM-DD using server-local time. */
function getServerToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default async function CalendarPage() {
  const cookieStore = await cookies();
  const initialMode = cookieStore.get('ratingo:calendar-mode')?.value === 'personalized'
    ? ('personalized' as const)
    : ('all' as const);

  // Skip global calendar fetch when user prefers personalized mode — the data won't be used.
  const initialData = initialMode === 'all'
    ? await catalogApi.getShowCalendar({ days: 7 }).catch(() => null)
    : null;

  const serverToday = getServerToday();

  return (
    <div className="min-h-screen bg-cinema-page">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{dict.calendar.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{dict.calendar.subtitle}</p>
        </header>

        <CalendarPageClient
          initialData={initialData}
          serverToday={serverToday}
          locale="uk"
          initialMode={initialMode}
        />
      </div>
    </div>
  );
}

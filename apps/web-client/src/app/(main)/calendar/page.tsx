/**
 * Calendar page — Server Component.
 *
 * Pre-fetches the current week's calendar on the server so the first paint is
 * populated. The client orchestrator takes over for week navigation.
 *
 * ISR: revalidates every 5 minutes (episode air dates change infrequently).
 */

import type { Metadata } from 'next';
import { getDictionary } from '@/shared/i18n';
import { catalogApi } from '@/core/api';
import { CalendarPageClient } from '@/modules/calendar';

const dict = getDictionary('uk');

export const metadata: Metadata = {
  title: dict.calendar.title,
  description: dict.calendar.description,
};

export const revalidate = 300;

/** Formats current date as YYYY-MM-DD using server-local time. */
function getServerToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default async function CalendarPage() {
  // Best-effort server pre-fetch — failures are silently swallowed so the page
  // always renders. The client will re-fetch on mount if initialData is null.
  const initialData = await catalogApi.getShowCalendar({ days: 7 }).catch(() => null);
  const serverToday = getServerToday();

  return (
    <div className="min-h-screen bg-cinema-page">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{dict.calendar.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{dict.calendar.subtitle}</p>
        </header>

        <CalendarPageClient initialData={initialData} serverToday={serverToday} locale="uk" />
      </div>
    </div>
  );
}

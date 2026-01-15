/**
 * Journal list page.
 * Shows all published journal posts with type filtering.
 * Uses SSR for initial data, client-side for filtering.
 */

import type { Metadata } from 'next';
import { getDictionary } from '@/shared/i18n';
import { getJournalPosts } from '@/core/api/journal.server';
import { JournalPageClient } from './client';

const dict = getDictionary('uk');

export const metadata: Metadata = {
  title: `${dict.journal.title} | Ratingo`,
  description: dict.journal.description,
};

// ISR: Revalidate every 60 seconds
export const revalidate = 60;

export default async function JournalPage() {
  // Fetch initial posts on server
  const initialData = await getJournalPosts({ limit: 20 });

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">{dict.journal.title}</h1>
          <p className="text-muted-foreground mt-2">{dict.journal.subtitle}</p>
        </header>

        <JournalPageClient initialData={initialData} />
      </div>
    </div>
  );
}

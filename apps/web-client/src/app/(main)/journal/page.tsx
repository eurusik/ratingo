/**
 * Journal list page.
 * Shows all published journal posts with type filtering.
 */

import type { Metadata } from 'next';
import { getDictionary } from '@/shared/i18n';
import { JournalPageClient } from './journal-page-client';

const dict = getDictionary('uk');

export const metadata: Metadata = {
  title: `${dict.journal.title} | Ratingo`,
  description: dict.journal.description,
};

export default function JournalPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">{dict.journal.title}</h1>
        </header>

        <JournalPageClient />
      </div>
    </main>
  );
}

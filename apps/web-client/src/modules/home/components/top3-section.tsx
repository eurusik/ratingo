/**
 * Top-3 hero section for homepage.
 *
 * Displays top 3 trending items as large cards.
 * Uses trophy emoji and "Топ-3" heading.
 */

'use client';

import { MediaCard, type MediaCardProps } from './media-card';
import { useTranslation } from '@/shared/i18n';

type MediaItem = Omit<MediaCardProps, 'rank'>;

interface Top3SectionProps {
  /** Array of media items (min 3). */
  items: MediaItem[];
  /** Optional section title override. */
  title?: string;
  className?: string;
}

/**
 * Hero section showing top 3 trending items.
 *
 * Cards are displayed in a 3-column grid on desktop,
 * stacked on mobile. Each card gets a rank badge (№1, №2, №3).
 *
 * @example
 * <Top3Section items={trendingShows.slice(0, 3)} />
 */
export function Top3Section({ items, title, className }: Top3SectionProps) {
  const { t } = useTranslation();

  // Need at least 3 items
  if (!Array.isArray(items) || items.length < 3) return null;

  const top3 = items.slice(0, 3);

  return (
    <section className={className}>
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <span>🏆</span>
        <span>{title || t('home.sections.top3') || 'Топ-3'}</span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {top3.map((item, index) => (
          <MediaCard key={item.id} {...item} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

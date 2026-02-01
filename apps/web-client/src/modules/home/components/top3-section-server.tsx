/**
 * Server-rendered Top-3 section for SSR/SSG.
 *
 * Horizontal cards layout for compact display.
 */

import { TrendingUp } from 'lucide-react';
import { HorizontalCard } from './media-card/horizontal-card';
import type { MediaCardServerProps } from './media-card/media-card-server';
import { getDictionary, type Locale } from '@/shared/i18n';

type MediaItem = Omit<MediaCardServerProps, 'rank' | 'locale' | 'badgeKey'>;

interface Top3SectionServerProps {
  items: MediaItem[];
  title?: string;
  locale?: Locale;
  className?: string;
  /** Number of items to display (default: 2 for hero companion, 3 for standalone) */
  count?: 2 | 3;
  /** Starting rank number (default: 2 for hero companion showing #2 and #3) */
  startRank?: number;
  /** Badge text to show instead of rank numbers (e.g., "Хіт") */
  badge?: string;
}

/**
 * Top-3 section with horizontal cards.
 *
 */
export function Top3SectionServer({
  items,
  title,
  locale = 'uk',
  className,
  count = 2,
  startRank = 2,
  badge,
}: Top3SectionServerProps) {
  const dict = getDictionary(locale);

  if (!Array.isArray(items) || items.length === 0) return null;

  const displayItems = items.slice(0, count);

  return (
    <section className={className}>
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-orange-500" />
        <span>{title || dict.home.sections.popularNow}</span>
      </h2>

      <div
        className={
          displayItems.length === 3
            ? 'grid grid-cols-1 md:grid-cols-3 gap-4'
            : displayItems.length === 2
              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
              : 'grid grid-cols-1 gap-4'
        }
      >
        {displayItems.map((item, index) => (
          <HorizontalCard
            key={item.id}
            {...item}
            rank={badge ? undefined : startRank + index}
            badge={badge}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

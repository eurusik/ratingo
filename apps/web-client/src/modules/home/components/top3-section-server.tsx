/**
 * Server-rendered Top-3 section for SSR/SSG.
 *
 * Horizontal cards layout for compact display.
 * Supports variants for different display contexts.
 */

import { TrendingUp, Eye } from 'lucide-react';
import { HorizontalCard, type HorizontalCardVariant } from './media-card/horizontal-card';
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
  /** Display variant for cards */
  variant?: HorizontalCardVariant;
}

/**
 * Top-3 section with horizontal cards.
 *
 * Variants:
 * - `topPicks`: stable quality picks with TrendingUp icon
 * - `watchingNow`: live activity with Radio (live) icon
 */
export function Top3SectionServer({
  items,
  title,
  locale = 'uk',
  className,
  count = 2,
  startRank = 2,
  badge,
  variant = 'topPicks',
}: Top3SectionServerProps) {
  const dict = getDictionary(locale);

  if (!Array.isArray(items) || items.length === 0) return null;

  const displayItems = items.slice(0, count);

  // Icon and color based on variant
  // watchingNow: Eye (viewing activity), emerald (active but not urgent)
  // topPicks: TrendingUp (quality ranking), orange (warm/premium)
  const Icon = variant === 'watchingNow' ? Eye : TrendingUp;
  const iconColor = variant === 'watchingNow' ? 'text-emerald-500' : 'text-orange-500';

  return (
    <section className={className}>
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
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
            // Only show ranks for watchingNow variant (ranked by watchers)
            // topPicks has no ranking - it's a quality selection
            rank={variant === 'watchingNow' ? startRank + index : undefined}
            badge={badge}
            variant={variant}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

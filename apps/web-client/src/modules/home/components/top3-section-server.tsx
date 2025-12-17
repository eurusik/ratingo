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
}

/**
 * Top-3 section with horizontal cards.
 *
 */
export function Top3SectionServer({ items, title, locale = 'uk', className }: Top3SectionServerProps) {
  const dict = getDictionary(locale);

  if (!Array.isArray(items) || items.length === 0) return null;

  // Show only 2 items (№2 and №3, since №1 is in Hero)
  const displayItems = items.slice(0, 2);

  return (
    <section className={className}>
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-orange-500" />
        <span>{title || dict.home.sections.popularNow}</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayItems.map((item, index) => (
          <HorizontalCard key={item.id} {...item} rank={index + 2} locale={locale} />
        ))}
      </div>
    </section>
  );
}

/**
 * New Episodes Section — compact row grid with collapse.
 * Mobile: 6 initial, Desktop: 9 initial, expands to 15.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Tv } from 'lucide-react';
import { cn, formatRelativeDate, type DateFreshness } from '@/shared/utils';
import { getDictionary, type Locale } from '@/shared/i18n';

/** Initial items shown on mobile before expand */
const MOBILE_INITIAL_COUNT = 6;

/** Initial items shown on desktop before expand */
const DESKTOP_INITIAL_COUNT = 9;

/** Max items to show after expand */
const MAX_ITEMS = 15;

/** Freshness-based text color classes */
const FRESHNESS_COLORS: Record<DateFreshness, string> = {
  fresh: 'text-cinema-text-muted',
  recent: 'text-cinema-text-muted',
  older: 'text-cinema-text-disabled',
} as const;

export interface NewEpisodeShowItem {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  airDate: string;
}

export interface NewEpisodesSectionProps {
  /** Pre-sorted items (newest first). Sorting should happen at data layer. */
  items: NewEpisodeShowItem[];
  locale?: Locale;
  className?: string;
}

/** Format episode label: S2 E1 or fallback */
function formatEpisodeLabel(season: number | null, episode: number | null, locale: Locale): string {
  if (season == null || episode == null) {
    return locale === 'uk' ? 'Новий' : 'New';
  }
  return `S${season} E${episode}`;
}

/** Compact episode card — horizontal layout for grid. */
function EpisodeCard({ item, locale }: { item: NewEpisodeShowItem; locale: Locale }) {
  const episodeLabel = formatEpisodeLabel(item.seasonNumber, item.episodeNumber, locale);
  const relativeDate = formatRelativeDate(item.airDate, locale);

  return (
    <Link
      href={`/shows/${item.slug}`}
      className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-cinema-elevated/40 transition-colors"
    >
      {/* Tiny thumbnail 32×48 */}
      <div className="relative w-8 h-12 flex-shrink-0 rounded overflow-hidden bg-cinema-elevated">
        {item.posterUrl ? (
          <Image src={item.posterUrl} alt={item.title} fill className="object-cover" sizes="32px" />
        ) : (
          <div className="w-full h-full bg-cinema-border" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-cinema-text-muted truncate">
          <span className="text-emerald-500/80 font-medium">{episodeLabel}</span>
          <span className="mx-1.5 text-cinema-text-disabled">·</span>
          <span className={FRESHNESS_COLORS[relativeDate.freshness]}>{relativeDate.text}</span>
        </p>
      </div>
    </Link>
  );
}

/** New Episodes Section — row grid with collapse. */
export function NewEpisodesSection({ items, locale = 'uk', className }: NewEpisodesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const dict = getDictionary(locale);

  if (items.length === 0) return null;

  const allItems = items.slice(0, MAX_ITEMS);

  // Different initial counts for mobile vs desktop
  const mobileHasMore = allItems.length > MOBILE_INITIAL_COUNT;
  const desktopHasMore = allItems.length > DESKTOP_INITIAL_COUNT;
  const mobileRemaining = Math.max(0, allItems.length - MOBILE_INITIAL_COUNT);
  const desktopRemaining = Math.max(0, allItems.length - DESKTOP_INITIAL_COUNT);

  // Visible items based on expand state
  const mobileVisible = isExpanded ? allItems : allItems.slice(0, MOBILE_INITIAL_COUNT);
  const desktopVisible = isExpanded ? allItems : allItems.slice(0, DESKTOP_INITIAL_COUNT);

  return (
    <section className={cn('mt-10', className)}>
      {/* Header */}
      <div className="mb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Tv className="w-4 h-4 text-blue-400" />
          {dict.home.sections.newEpisodes}
        </h2>
      </div>

      {/* Row grid: 1 → 2 → 3 → 4 cols by breakpoint */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-4 gap-y-1">
        {/* Mobile items */}
        {mobileVisible.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              index >= MOBILE_INITIAL_COUNT && !isExpanded && 'hidden',
              index >= DESKTOP_INITIAL_COUNT && !isExpanded && 'sm:hidden',
              index < DESKTOP_INITIAL_COUNT && 'sm:block',
            )}
          >
            <EpisodeCard item={item} locale={locale} />
          </div>
        ))}

        {/* Desktop-only items (between mobile and desktop thresholds) */}
        {!isExpanded &&
          desktopVisible.slice(MOBILE_INITIAL_COUNT).map((item) => (
            <div key={item.id} className="hidden sm:block">
              <EpisodeCard item={item} locale={locale} />
            </div>
          ))}
      </div>

      {/* Expand button — shown when collapsed and has more items */}
      {!isExpanded && (mobileHasMore || desktopHasMore) && (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-3 text-sm text-cinema-text-muted hover:text-cinema-text-muted transition-colors"
        >
          {/* Mobile text — hidden on desktop, or if no mobile overflow */}
          <span className={mobileHasMore ? 'sm:hidden' : 'hidden'}>
            {dict.common.showMore.replace('{count}', String(mobileRemaining))}
          </span>
          {/* Desktop text — hidden on mobile, or if no desktop overflow */}
          <span className={desktopHasMore ? 'hidden sm:inline' : 'hidden'}>
            {dict.common.showMore.replace('{count}', String(desktopRemaining))}
          </span>
        </button>
      )}
    </section>
  );
}

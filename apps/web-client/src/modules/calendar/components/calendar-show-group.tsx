'use client';

/**
 * Compact multi-episode card for when a TV show drops several episodes
 * on the same calendar day (e.g. a full Netflix season drop).
 *
 * Replaces N repeated individual CalendarEpisodeCard entries with a single
 * grouped card that shows the episode range badge, total count, and a
 * condensed per-episode list (number + title + runtime).
 *
 * Layout:
 *   [Poster 48×72]  Show Title              S8 E1–E8
 *                   8 епізодів
 *                   E1  Episode Title         48 хв
 *                   E2  Episode Title         48 хв
 *                   ...
 */

import Link from 'next/link';
import Image from 'next/image';
import { Clock } from 'lucide-react';
import { cn, resolveMediaImageUrl, IMAGE_SIZES, pluralize } from '@/shared/utils';
import type { CalendarEpisode } from './calendar-day-group';
import { isGenericTitle } from '../utils/episode.utils';

export interface CalendarShowGroupProps {
  showSlug: string;
  showTitle: string;
  posterPath: string | null;
  /** Episodes already sorted by season + episode number. */
  episodes: CalendarEpisode[];
}

/**
 * Builds a human-readable episode range label.
 *
 * Same season:  S8 E1–E8
 * Cross-season: S1 E10 – S2 E1
 */
function formatEpisodeRange(episodes: CalendarEpisode[]): string {
  const first = episodes[0];
  const last = episodes[episodes.length - 1];
  if (first.seasonNumber === last.seasonNumber) {
    return `S${first.seasonNumber} E${first.episodeNumber}–E${last.episodeNumber}`;
  }
  return `S${first.seasonNumber} E${first.episodeNumber} – S${last.seasonNumber} E${last.episodeNumber}`;
}

export function CalendarShowGroup({
  showSlug,
  showTitle,
  posterPath,
  episodes,
}: CalendarShowGroupProps) {
  const posterUrl = resolveMediaImageUrl(posterPath, IMAGE_SIZES.W92);
  const rangeLabel = formatEpisodeRange(episodes);
  const countLabel = `${episodes.length} ${pluralize(episodes.length, {
    one: 'епізод',
    few: 'епізоди',
    many: 'епізодів',
  })}`;

  const hasUsefulDetails = episodes.some(
    (ep) => !isGenericTitle(ep.title) || ep.runtime != null,
  );

  return (
    <Link
      href={`/shows/${showSlug}`}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg',
        'hover:bg-cinema-elevated/40 transition-colors',
      )}
    >
      {/* Poster thumbnail — 48×72px, top-aligned with items-start on parent */}
      <div className="relative w-12 h-[72px] flex-shrink-0 rounded-md overflow-hidden bg-cinema-elevated">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={showTitle}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="w-full h-full bg-cinema-elevated" />
        )}
      </div>

      {/* Right side — title row + episode range badge + compact episode list */}
      <div className="flex-1 min-w-0">
        {/* First row: show title + range badge */}
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm text-white truncate group-hover:text-blue-400 transition-colors">
            {showTitle}
          </h3>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 shrink-0">
            {rangeLabel}
          </span>
        </div>

        {/* Episode count */}
        <p className="text-xs text-cinema-text-muted mt-0.5">{countLabel}</p>

        {/* Compact per-episode list */}
        {hasUsefulDetails && (
          <ul className="mt-1.5 space-y-0.5">
            {episodes.map((ep) => (
              <li
                key={`${ep.showId}-s${ep.seasonNumber}e${ep.episodeNumber}`}
                className="flex items-center gap-2"
              >
                {/* Episode number label */}
                <span className="text-[11px] text-cinema-text-muted font-mono shrink-0">
                  E{ep.episodeNumber}
                </span>

                {/* Episode title — fills remaining space, truncated */}
                {!isGenericTitle(ep.title) && (
                  <span className="truncate text-sm text-cinema-text-secondary flex-1 min-w-0">
                    {ep.title}
                  </span>
                )}

                {/* Runtime — right-aligned, only rendered when present */}
                {ep.runtime != null && (
                  <span className="flex items-center gap-0.5 text-xs text-cinema-text-muted shrink-0 ml-auto">
                    <Clock className="w-3 h-3" />
                    {ep.runtime} хв
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}

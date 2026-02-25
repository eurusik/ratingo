'use client';

/**
 * Horizontal card for a single episode in the calendar view.
 *
 * Layout:
 * - Left: poster thumbnail (48x72px)
 * - Center: show title, episode badge (SxEx), episode title, runtime
 */

import Link from 'next/link';
import Image from 'next/image';
import { Clock } from 'lucide-react';
import { cn, resolveMediaImageUrl, IMAGE_SIZES } from '@/shared/utils';
import { isGenericTitle } from '../utils/episode.utils';

export interface CalendarEpisodeCardProps {
  showSlug: string;
  showTitle: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  /** Episode title */
  title: string;
  runtime: number | null;
}

/**
 * Formats the season/episode badge label.
 * e.g. seasonNumber=2, episodeNumber=5 → "S2 E5"
 */
function formatEpisodeLabel(season: number, episode: number): string {
  return `S${season} E${episode}`;
}

/**
 * Formats runtime as a localized string.
 * Returns null when runtime is absent.
 */
function formatRuntime(minutes: number | null): string | null {
  if (minutes == null) return null;
  return `${minutes} хв`;
}

export function CalendarEpisodeCard({
  showSlug,
  showTitle,
  posterPath,
  seasonNumber,
  episodeNumber,
  title,
  runtime,
}: CalendarEpisodeCardProps) {
  const posterUrl = resolveMediaImageUrl(posterPath, IMAGE_SIZES.W92);
  const episodeLabel = formatEpisodeLabel(seasonNumber, episodeNumber);
  const runtimeLabel = formatRuntime(runtime);

  return (
    <Link
      href={`/shows/${showSlug}`}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-lg',
        'hover:bg-cinema-elevated/40 transition-colors',
      )}
    >
      {/* Poster thumbnail — 48×72px */}
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

      {/* Center — main info */}
      <div className="flex-1 min-w-0">
        {/* Show title */}
        <h3 className="font-bold text-sm text-white truncate group-hover:text-blue-400 transition-colors">
          {showTitle}
        </h3>

        {/* Episode badge + episode title row */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 shrink-0">
            {episodeLabel}
          </span>
          {!isGenericTitle(title) && (
            <span className="text-sm text-cinema-text-secondary truncate">{title}</span>
          )}
        </div>

        {/* Runtime */}
        {runtimeLabel && (
          <div className="flex items-center gap-1 mt-1 text-xs text-cinema-text-muted">
            <Clock className="w-3 h-3 shrink-0" />
            <span>{runtimeLabel}</span>
          </div>
        )}
      </div>

    </Link>
  );
}

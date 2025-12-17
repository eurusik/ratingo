/**
 * Horizontal media card for Top-3 section.
 *
 * Compact layout: poster left, info right.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Activity, TrendingUp, Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { formatYear, formatRating } from '@/shared/utils/format';
import { getDictionary, type Locale } from '@/shared/i18n';
import type { MediaCardServerProps } from './media-card-server';

interface HorizontalCardProps extends Omit<MediaCardServerProps, 'badgeKey'> {
  rank: number;
}

/**
 * Horizontal card for Top-3 display.
 *
 * Layout: [Rank] [Poster] | Title, Rating, Year →
 */
export function HorizontalCard(props: HorizontalCardProps) {
  const {
    slug,
    type,
    title,
    poster,
    stats,
    releaseDate,
    rank,
    locale = 'uk',
  } = props;

  const dict = getDictionary(locale);
  const href = (type === 'movie' ? `/movies/${slug}` : `/shows/${slug}`) as Route;
  const posterUrl = poster?.medium ?? null;
  const rating = stats?.qualityScore ?? null;
  const watchers = stats?.liveWatchers ?? null;

  // Rank colors
  const rankColors: Record<number, string> = {
    2: 'bg-zinc-400 text-zinc-900', // Silver
    3: 'bg-amber-700 text-white',   // Bronze
  };

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-stretch gap-4 p-3 rounded-xl',
        'bg-[#111113] border border-zinc-800/50',
        'hover:border-zinc-700 hover:bg-zinc-900/80',
        'transition-all duration-200'
      )}
    >
      {/* Rank Badge */}
      <div className="flex items-center">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            'font-bold text-sm',
            rankColors[rank] || 'bg-zinc-700 text-white'
          )}
        >
          {rank}
        </div>
      </div>

      {/* Poster */}
      <div className="relative w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
            {dict.card.noPoster}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
        {/* Title */}
        <h3 className="font-semibold text-white text-base leading-tight line-clamp-2 group-hover:text-blue-400 transition-colors">
          {title}
        </h3>

        {/* Meta row */}
        <div className="flex items-center gap-4 mt-2 text-sm">
          {/* Rating */}
          {rating && (
            <div className="flex items-center gap-1 text-zinc-300">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="font-medium">{formatRating(rating)}</span>
            </div>
          )}

          {/* Interest */}
          {watchers && (
            <div className="flex items-center gap-1 text-zinc-400">
              <TrendingUp className="w-4 h-4" />
              <span>{watchers.toLocaleString()}</span>
            </div>
          )}

          {/* Year */}
          {releaseDate && (
            <div className="flex items-center gap-1 text-zinc-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatYear(releaseDate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Arrow indicator */}
      <div className="flex items-center text-zinc-600 group-hover:text-zinc-400 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

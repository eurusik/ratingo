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
  /** Rank number to display (1, 2, 3...) */
  rank?: number;
  /** Badge text to show instead of rank (e.g., "Хіт") */
  badge?: string;
}

/**
 * Horizontal card for Top-3 display.
 *
 * Layout: [Rank] [Poster] | Title, Rating, Year →
 */
export function HorizontalCard(props: HorizontalCardProps) {
  const { slug, type, title, poster, stats, releaseDate, rank, badge, locale = 'uk' } = props;

  const dict = getDictionary(locale);
  const href = (type === 'movie' ? `/movies/${slug}` : `/shows/${slug}`) as Route;
  const posterUrl = poster?.medium ?? null;
  const rating = stats?.qualityScore ?? null;
  const watchers = stats?.liveWatchers ?? null;

  // Rank colors (for numbered ranks)
  const rankColors: Record<number, string> = {
    1: 'bg-yellow-500 text-yellow-900', // Gold
    2: 'bg-zinc-400 text-zinc-900', // Silver
    3: 'bg-amber-700 text-white', // Bronze
  };

  // Badge style (for text badges like "Хіт")
  const badgeStyle = 'bg-red-600 text-white';

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-stretch gap-4 p-3 rounded-xl',
        'bg-[#111113] border border-cinema-borderSoft/50',
        'hover:border-cinema-border hover:bg-cinema-card/80',
        'transition-all duration-200',
      )}
    >
      {/* Rank or Badge */}
      <div className="flex items-center">
        {badge ? (
          <div
            className={cn(
              'px-2.5 py-1 rounded-full flex items-center justify-center',
              'font-bold text-xs',
              badgeStyle,
            )}
          >
            {badge}
          </div>
        ) : rank ? (
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              'font-bold text-sm',
              rankColors[rank] || 'bg-cinema-border text-white',
            )}
          >
            {rank}
          </div>
        ) : null}
      </div>

      {/* Poster */}
      <div className="relative w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-cinema-elevated">
        {posterUrl ? (
          <Image src={posterUrl} alt={title} fill className="object-cover" sizes="64px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-cinema-text-disabled text-xs">
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
            <div className="flex items-center gap-1 text-cinema-text-secondary">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="font-medium">{formatRating(rating)}</span>
            </div>
          )}

          {/* Interest */}
          {watchers != null && watchers > 0 && (
            <div className="flex items-center gap-1 text-cinema-text-muted">
              <TrendingUp className="w-4 h-4" />
              <span>{watchers.toLocaleString()}</span>
            </div>
          )}

          {/* Year */}
          {releaseDate && (
            <div className="flex items-center gap-1 text-cinema-text-muted">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatYear(releaseDate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Arrow indicator */}
      <div className="flex items-center text-cinema-text-disabled group-hover:text-cinema-text-muted transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

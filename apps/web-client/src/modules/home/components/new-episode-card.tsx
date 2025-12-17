'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { NewEpisodeItem } from '@/core/api/catalog';

interface NewEpisodeCardProps {
  item: NewEpisodeItem;
  locale?: string;
}

/**
 * Formats air date as relative time (today, yesterday, X days ago).
 */
function formatRelativeDate(airDate: string, locale: string): string {
  const date = new Date(airDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (locale === 'uk') {
    if (diffDays === 0) return 'сьогодні';
    if (diffDays === 1) return 'вчора';
    if (diffDays < 7) return `${diffDays} дн. тому`;
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  }

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/**
 * Card for new episode update feed.
 * Shows: poster, title, SxEy, relative air date.
 */
export function NewEpisodeCard({ item, locale = 'uk' }: NewEpisodeCardProps) {
  const episodeLabel = `S${item.seasonNumber}E${item.episodeNumber}`;
  const relativeDate = formatRelativeDate(item.airDate, locale);

  return (
    <Link
      href={`/shows/${item.slug}`}
      className="group flex gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
    >
      {/* Poster */}
      <div className="relative w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-zinc-800">
        {item.posterPath ? (
          <Image
            src={`https://image.tmdb.org/t/p/w154${item.posterPath}`}
            alt={item.title}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
            No poster
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center min-w-0">
        <h3 className="font-medium text-sm text-white truncate group-hover:text-blue-400 transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          <span className="text-emerald-400 font-medium">{episodeLabel}</span>
          <span className="mx-1.5">•</span>
          <span>{relativeDate}</span>
        </p>
        {item.episodeTitle && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {item.episodeTitle}
          </p>
        )}
      </div>
    </Link>
  );
}

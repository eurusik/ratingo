/**
 * Card component for watchlist and history items.
 * Shows state badge, progress, and rating.
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { Star, Clock, Play, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useTranslation } from '@/shared/i18n';
import type { MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import { SeasonProgressRing } from '@/modules/details/components/season-progress-ring';

type UserMediaState = MeUserMediaListItemDto['state'];

interface MeListItemCardProps {
  item: MeUserMediaListItemDto;
}

const stateConfig: Record<
  UserMediaState,
  { icon: typeof Play; colorClass: string; bgClass: string }
> = {
  watching: {
    icon: Play,
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10',
  },
  completed: {
    icon: CheckCircle,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
  },
  planned: {
    icon: Clock,
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
  },
  dropped: {
    icon: XCircle,
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
  },
};

function formatProgress(progress: Record<string, unknown> | null): string | null {
  if (!progress) return null;

  // Handle seasons progress format: { seasons: { "1": 3, "2": 5 } }
  const seasons = progress.seasons as Record<string, number> | undefined;
  if (seasons) {
    const seasonNumbers = Object.keys(seasons)
      .map(Number)
      .sort((a, b) => b - a);
    if (seasonNumbers.length > 0) {
      const latestSeason = seasonNumbers[0];
      const episodeCount = seasons[latestSeason.toString()];
      return `S${latestSeason}:E${episodeCount}`;
    }
  }

  return null;
}

function formatRelativeDate(dateString: string, dict: Record<string, string>): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return dict.today;
  if (diffDays === 1) return dict.yesterday;
  if (diffDays < 30) return dict.daysAgo.replace('{count}', String(diffDays));

  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export function MeListItemCard({ item }: MeListItemCardProps) {
  const { dict } = useTranslation();
  const media = item.mediaSummary;

  if (!media) return null;

  const href = media.type === 'movie' ? `/movies/${media.slug}` : `/shows/${media.slug}`;
  const year = media.releaseDate ? new Date(media.releaseDate).getFullYear() : null;
  const poster = media.poster as Record<string, string> | null;

  const stateInfo = stateConfig[item.state];
  const StateIcon = stateInfo.icon;
  const stateLabel = dict.saved.states?.[item.state as keyof typeof dict.saved.states] ?? item.state;

  const progress = formatProgress(item.progress as Record<string, unknown> | null);
  const typeLabel = media.type === 'movie' ? dict.mediaType.movie : dict.mediaType.show;

  return (
    <Link
      href={href as Route}
      className="group relative flex gap-3 p-3 rounded-lg bg-cinema-card/50 hover:bg-cinema-elevated/50 transition-colors"
    >
      {/* Poster */}
      <div className="shrink-0">
        <div className="relative w-16 h-24 rounded-md overflow-hidden bg-cinema-elevated">
          {poster?.small ? (
            <Image src={poster.small} alt={media.title} fill sizes="64px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-cinema-text-disabled text-xs">
              —
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          {/* Title row with progress ring */}
          <div className="flex items-start gap-2">
            <h3 className="font-medium text-cinema-text-primary truncate group-hover:text-white transition-colors flex-1 min-w-0">
              {media.title}
            </h3>
            {/* Progress ring for shows */}
            {item.progressSummary && media.type === 'show' && (
              <SeasonProgressRing
                watched={item.progressSummary.watched}
                total={item.progressSummary.total}
                size="md"
              />
            )}
          </div>
          <p className="text-sm text-cinema-text-muted">
            {typeLabel}
            {year && ` • ${year}`}
          </p>

          {/* State badge */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                stateInfo.bgClass,
                stateInfo.colorClass,
              )}
            >
              <StateIcon className="w-3 h-3" />
              {stateLabel}
            </span>

            {/* Progress for shows */}
            {progress && media.type === 'show' && (
              <span className="text-xs text-cinema-text-muted">{progress}</span>
            )}
          </div>
        </div>

        {/* Bottom row: rating and date */}
        <div className="flex items-center gap-3 mt-2 text-xs text-cinema-text-disabled">
          {item.rating !== null && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500" fill="currentColor" />
              {item.rating}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatRelativeDate(item.updatedAt, {
              today: dict.reviews?.card?.today ?? 'сьогодні',
              yesterday: dict.reviews?.card?.yesterday ?? 'вчора',
              daysAgo: dict.reviews?.card?.daysAgo ?? '{count} дн. тому',
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}

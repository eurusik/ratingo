'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { useTranslation, useLocale } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui';
import { useAuth } from '@/core/auth';
import { formatRelativeDate } from '@/shared/utils/format';
import type { FavoriteUpdateItem } from '@/core/api/me-lists.client';
import { UserRatingBadge } from '@/shared/components/user-rating-badge';
import { useFavoriteUpdates } from '../hooks/use-me-lists';

interface FavoriteUpdateCardProps {
  item: FavoriteUpdateItem;
  index: number;
}

function FavoriteUpdateCard({ item, index }: FavoriteUpdateCardProps) {
  const locale = useLocale();
  const { dict } = useTranslation();
  const { mediaSummary, rating, latestEpisode, nextEpisode } = item;
  const poster = mediaSummary.poster as Record<string, string> | null;
  const posterUrl = poster?.medium ?? poster?.small ?? null;

  const isUpcoming = nextEpisode != null;
  const episodeToShow = nextEpisode ?? latestEpisode;

  const isBatch = episodeToShow?.isBatchRelease ?? false;

  const eventLabel = isUpcoming
    ? (dict.activity?.favoriteUpdates?.nextEpisode ?? 'Наступний епізод')
    : isBatch
      ? (dict.activity?.favoriteUpdates?.newSeason ?? 'Новий сезон')
      : (dict.activity?.favoriteUpdates?.newEpisode ?? 'Новий епізод');

  return (
    <Link
      href={mediaSummary.type === 'movie' ? `/movies/${mediaSummary.slug}` : `/shows/${mediaSummary.slug}`}
      className="flex-shrink-0 w-[200px] rounded-lg bg-cinema-card/50 border border-white/5 overflow-hidden hover:border-white/15 transition-colors"
    >
      {posterUrl ? (
        <div className="relative aspect-[2/3] w-full">
          <Image
            src={posterUrl}
            alt={mediaSummary.title}
            fill
            className="object-cover"
            sizes="200px"
            loading={index < 3 ? 'eager' : 'lazy'}
          />
          <UserRatingBadge
            rating={rating}
            label={(dict.card?.yourRating ?? 'Ваша оцінка: {rating}').replace('{rating}', String(rating))}
            className="absolute bottom-2 left-2"
          />
        </div>
      ) : (
        <div className="aspect-[2/3] w-full bg-cinema-card flex items-center justify-center text-gray-500">
          <Star className="w-8 h-8" />
        </div>
      )}
      <div className="p-3 space-y-1">
        <h4 className="text-sm font-medium text-white truncate">{mediaSummary.title}</h4>
        {episodeToShow && (
          <p className="text-xs text-gray-400">
            {eventLabel}
            {episodeToShow.airDate && (
              <span className="text-gray-500">
                {' • '}{formatRelativeDate(episodeToShow.airDate, locale).text}
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

export function FavoriteUpdates() {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useFavoriteUpdates(isAuthenticated);

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="space-y-3 mb-8">
        <Skeleton className="h-6 w-64" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-[200px] h-[340px] rounded-lg shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  const items = data?.data ?? [];

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400 mb-8">
        {dict.activity?.favoriteUpdates?.empty ?? 'Оціни серіали, щоб бачити оновлення тут'}
      </p>
    );
  }

  return (
    <div className="space-y-3 mt-10 pt-8 border-t border-white/5">
      <h3 className="text-lg font-semibold text-white">
        {dict.activity?.favoriteUpdates?.title ?? 'Що нового у твоїх серіалах'}
      </h3>
      <div
        className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-white/10"
        role="region"
        aria-label={dict.activity?.favoriteUpdates?.title ?? 'Що нового у твоїх серіалах'}
        tabIndex={0}
      >
        {items.map((item, index) => (
          <FavoriteUpdateCard key={item.mediaItemId} item={item} index={index} />
        ))}
      </div>
    </div>
  );
}

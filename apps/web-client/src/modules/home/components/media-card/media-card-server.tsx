/**
 * Server-safe media card for SSR/SSG.
 */

import { Calendar } from 'lucide-react';
import type { BadgeKey, ImageDto, RatingoStatsDto, ExternalRatingsDto, ShowProgressDto } from '@/modules/home/types';
import { cn } from '@/shared/utils';
import { formatYear } from '@/shared/utils/format';
import { getDictionary, type Locale } from '@/shared/i18n';
import { CardLayout, cardTitleStyles } from './card-layout';
import { CardPoster } from './card-poster';
import { CardRating } from './card-rating';
import { CardBadge, RankBadge, badgeLabelKeys } from './card-badge';
import { CardBookmark } from './card-cta';


/** Props for MediaCardServer - minimalist view props. */
export interface MediaCardServerProps {
  id: string;
  slug: string;
  type: 'movie' | 'show';
  title: string;
  poster?: ImageDto | null;
  stats?: RatingoStatsDto | null;
  externalRatings?: ExternalRatingsDto | null;
  showProgress?: ShowProgressDto | null;
  releaseDate?: string | null;
  badgeKey?: BadgeKey | null;
  rank?: number;
  locale?: Locale;
}

/**
 * SSR-safe minimalist media card component.
 *
 */
export function MediaCardServer(props: MediaCardServerProps) {
  const {
    id,
    slug,
    type,
    title,
    poster,
    stats,
    externalRatings,
    showProgress: progress,
    releaseDate,
    rank,
    badgeKey,
    locale = 'uk',
  } = props;

  const dict = getDictionary(locale);

  // Derived values
  const posterUrl = poster?.medium ?? null;
  const rating = stats?.qualityScore ?? null;
  const watchers = stats?.liveWatchers ?? null;
  const href = type === 'movie' ? `/movies/${slug}` : `/shows/${slug}`;

  const posterSlot = (
    <CardPoster src={posterUrl} alt={title} type={type} noPosterText={dict.card.noPoster}>
      {/* ONE badge: Rank (№1-3) OR Status (🔥 Trending) */}
      {rank != null && rank <= 3 ? (
        <RankBadge rank={rank} />
      ) : badgeKey ? (
        <CardBadge badgeKey={badgeKey} label={dict.card.badge[badgeLabelKeys[badgeKey]]} position="top-right" />
      ) : null}
    </CardPoster>
  );

  // CardBookmark is a client component - self-contained with API integration
  const overlaySlot = <CardBookmark mediaItemId={id} />;

  return (
    <CardLayout href={href} as="article" poster={posterSlot} overlay={overlaySlot}>
      {/* Title */}
      <h3 className={cn(cardTitleStyles)}>
        {title}
      </h3>

      {/* ⭐ Rating left, 👁 Watchers right */}
      <CardRating rating={rating} watchers={watchers} className="mb-2" />

      {/* 📅 Year (separate row) */}
      {releaseDate ? (
        <div className="text-sm text-gray-400 flex items-center gap-1.5 mt-auto">
          <Calendar className="w-4 h-4" />
          <span>{formatYear(releaseDate)}</span>
        </div>
      ) : null}
    </CardLayout>
  );
}

import { Clapperboard, Tv } from 'lucide-react';
import type { MediaType } from '@/shared/api';
import { DESKTOP_MEDIA_QUERY, tmdbPosterSrcSet, type TmdbPosterWidth } from '@/shared/config';
import { ReturningImage } from '@/shared/ui';

type PosterSize = 'row' | 'list' | 'rank' | 'grid';

export type PosterLoadPriority = 'high' | 'eager' | 'lazy';

interface PosterLayout {
  width: number;
  height: number;
  className: string;
  sizes: string;
  srcWidths: readonly TmdbPosterWidth[];
}

const DESKTOP_SLOT_SIZES = `${DESKTOP_MEDIA_QUERY} 200px`;

const TILE_POSTER_WIDTHS: readonly TmdbPosterWidth[] = ['w154', 'w185', 'w342'];

const POSTER_SIZES: Record<PosterSize, PosterLayout> = {
  row: {
    width: 40,
    height: 60,
    className: 'h-15 w-10 rounded-lg',
    sizes: '40px',
    srcWidths: ['w92', 'w154'],
  },
  list: {
    width: 154,
    height: 231,
    className: 'h-24 w-16 rounded-lg',
    sizes: '64px',
    srcWidths: ['w92', 'w154', 'w185'],
  },
  rank: {
    width: 154,
    height: 231,
    className: 'h-36 w-24 rounded-xl md:aspect-2/3 md:h-auto md:w-full',
    sizes: `${DESKTOP_SLOT_SIZES}, 96px`,
    srcWidths: TILE_POSTER_WIDTHS,
  },
  grid: {
    width: 342,
    height: 513,
    className: 'aspect-2/3 h-auto w-full rounded-xl',
    sizes: `${DESKTOP_SLOT_SIZES}, 33vw`,
    srcWidths: TILE_POSTER_WIDTHS,
  },
};

interface MediaPosterProps {
  type: MediaType;
  posterUrl?: string;
  size?: PosterSize;
  loadPriority?: PosterLoadPriority;
}

export function MediaTypeIcon({ type, className }: { type: MediaType; className?: string }) {
  const Icon = type === 'movie' ? Clapperboard : Tv;
  return <Icon aria-hidden className={className} />;
}

export function MediaPoster({
  type,
  posterUrl,
  size = 'row',
  loadPriority = 'lazy',
}: MediaPosterProps) {
  const { width, height, className, sizes, srcWidths } = POSTER_SIZES[size];

  if (!posterUrl) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center bg-surface-secondary text-muted ${className}`}
      >
        <MediaTypeIcon type={type} className="size-4" />
      </span>
    );
  }

  return (
    <ReturningImage
      src={posterUrl}
      srcSet={tmdbPosterSrcSet(posterUrl, srcWidths)}
      sizes={sizes}
      alt=""
      width={width}
      height={height}
      unoptimized
      loading={loadPriority === 'lazy' ? 'lazy' : 'eager'}
      fetchPriority={loadPriority === 'high' ? 'high' : 'auto'}
      className={`shrink-0 bg-surface-secondary object-cover ${className}`}
    />
  );
}

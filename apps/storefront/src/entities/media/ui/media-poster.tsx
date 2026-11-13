import Image from 'next/image';
import { Clapperboard, Tv } from 'lucide-react';
import type { MediaType } from '@/shared/api';

type PosterSize = 'row' | 'list' | 'rank' | 'grid';

const POSTER_SIZES: Record<PosterSize, { width: number; height: number; className: string }> = {
  row: { width: 40, height: 60, className: 'h-15 w-10 rounded-lg' },
  list: { width: 154, height: 231, className: 'h-24 w-16 rounded-lg' },
  rank: {
    width: 154,
    height: 231,
    className: 'h-36 w-24 rounded-xl md:aspect-2/3 md:h-auto md:w-full',
  },
  grid: { width: 342, height: 513, className: 'aspect-2/3 h-auto w-full rounded-xl' },
};

interface MediaPosterProps {
  type: MediaType;
  posterUrl?: string;
  size?: PosterSize;
  isPriority?: boolean;
}

export function MediaTypeIcon({ type, className }: { type: MediaType; className?: string }) {
  const Icon = type === 'movie' ? Clapperboard : Tv;
  return <Icon aria-hidden className={className} />;
}

export function MediaPoster({ type, posterUrl, size = 'row', isPriority = false }: MediaPosterProps) {
  const { width, height, className } = POSTER_SIZES[size];

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
    <Image
      src={posterUrl}
      alt=""
      width={width}
      height={height}
      unoptimized
      loading={isPriority ? 'eager' : 'lazy'}
      fetchPriority={isPriority ? 'high' : 'auto'}
      className={`shrink-0 bg-surface-secondary object-cover ${className}`}
    />
  );
}

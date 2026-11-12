import Image from 'next/image';
import { Clapperboard, Tv } from 'lucide-react';
import type { MediaType } from '@/shared/api';

type PosterSize = 'row' | 'rank';

const POSTER_SIZES: Record<PosterSize, { width: number; height: number; className: string }> = {
  row: { width: 40, height: 60, className: 'h-15 w-10 rounded-lg' },
  rank: {
    width: 154,
    height: 231,
    className: 'h-27 w-19 rounded-xl md:aspect-2/3 md:h-auto md:w-full',
  },
};

interface MediaPosterProps {
  type: MediaType;
  posterUrl?: string;
  size?: PosterSize;
}

export function MediaTypeIcon({ type, className }: { type: MediaType; className?: string }) {
  const Icon = type === 'movie' ? Clapperboard : Tv;
  return <Icon aria-hidden className={className} />;
}

export function MediaPoster({ type, posterUrl, size = 'row' }: MediaPosterProps) {
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
      className={`shrink-0 bg-surface-secondary object-cover ${className}`}
    />
  );
}

import { cn } from '@ratingo/web-core/lib';
import { tmdbPosterUrl, tmdbStillUrl } from '@/shared/config';
import { ReturningImage } from '@/shared/ui';
import type { Episode } from '../model/season';

const SIZES = {
  row: { width: 112, height: 63, className: 'h-[63px] w-28' },
  card: { width: 88, height: 52, className: 'h-13 w-22' },
} as const;

interface EpisodeStillProps {
  episode: Episode;
  badge: string;
  size: keyof typeof SIZES;
  isDimmed?: boolean;
  fallbackPosterPath?: string;
}

function stillOrPoster(episode: Episode, fallbackPosterPath: string | undefined) {
  const still = tmdbStillUrl(episode.stillPath);
  if (still) return { src: still, isPoster: false };
  return { src: tmdbPosterUrl(fallbackPosterPath, 'w154'), isPoster: true };
}

export function EpisodeStill({
  episode,
  badge,
  size,
  isDimmed = false,
  fallbackPosterPath,
}: EpisodeStillProps) {
  const { width, height, className } = SIZES[size];
  const { src, isPoster } = stillOrPoster(episode, fallbackPosterPath);

  return (
    <span
      aria-hidden
      className={cn('relative shrink-0 overflow-hidden rounded-[10px] bg-default', className)}
    >
      {src ? (
        <ReturningImage
          unoptimized
          src={src}
          alt=""
          width={width}
          height={height}
          loading="lazy"
          className={cn('size-full object-cover', isPoster && 'object-[center_20%]')}
        />
      ) : null}
      {isDimmed ? <span className="absolute inset-0 bg-background/45" /> : null}
      <span className="absolute start-1.5 bottom-1.5 inline-flex h-5 items-center rounded-md bg-black/80 px-1.5 text-xs font-extrabold text-white tabular-nums">
        {badge}
      </span>
    </span>
  );
}

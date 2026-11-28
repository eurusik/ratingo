import { tmdbPosterUrl, tmdbStillUrl } from '@/shared/config';
import { StillFrame, type StillSize } from '@/shared/ui';
import type { Episode } from '../model/season';

interface EpisodeStillProps {
  episode: Episode;
  badge: string;
  size: StillSize;
  isDimmed?: boolean;
  fallbackPosterPath?: string;
}

function stillOrPoster(episode: Episode, size: StillSize, fallbackPosterPath: string | undefined) {
  const still = tmdbStillUrl(episode.stillPath, size === 'hero' ? 'w780' : 'w300');
  if (still) return { src: still, isPoster: false };
  return { src: tmdbPosterUrl(fallbackPosterPath, 'w342'), isPoster: true };
}

export function EpisodeStill({
  episode,
  badge,
  size,
  isDimmed = false,
  fallbackPosterPath,
}: EpisodeStillProps) {
  const { src, isPoster } = stillOrPoster(episode, size, fallbackPosterPath);

  return (
    <StillFrame src={src} size={size} isPoster={isPoster} isDimmed={isDimmed}>
      <span className="absolute start-1.5 bottom-1.5 inline-flex h-5 items-center rounded-md bg-black/80 px-1.5 text-xs font-extrabold text-white tabular-nums">
        {badge}
      </span>
    </StillFrame>
  );
}

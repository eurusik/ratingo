/**
 * Episode info component for show cards.
 *
 */

import { cn } from '@/shared/utils';

interface CardEpisodeInfoProps {
  /** Season number. */
  season: number;
  /** Episode number. */
  episode: number;
  className?: string;
}

/**
 * Minimalist episode badge only.
 */
export function CardEpisodeInfo({ season, episode, className }: CardEpisodeInfoProps) {
  return (
    <span className={cn('inline-block px-2 py-0.5 bg-zinc-800 rounded font-mono text-white text-xs', className)}>
      S{season}E{episode}
    </span>
  );
}

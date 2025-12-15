/**
 * Episode info component for show cards.
 *
 * Displays next episode badge and air date.
 */

import { cn } from '@/shared/utils';
import { formatDate } from '@/shared/utils/format';

interface CardEpisodeInfoProps {
  /** Season number. */
  season: number;
  /** Episode number. */
  episode: number;
  /** Air date of the episode. */
  airDate?: string | null;
  className?: string;
}

/**
 * Episode badge with air date for shows.
 *
 * @example
 * <CardEpisodeInfo season={4} episode={9} airDate="2025-12-19" />
 * // [S4E9] 19 гру 2025
 */
export function CardEpisodeInfo({ season, episode, airDate, className }: CardEpisodeInfoProps) {
  return (
    <div className={cn('flex items-center space-x-2 text-xs', className)}>
      <span className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-white">
        S{season}E{episode}
      </span>
      {airDate && <span className="text-gray-300">{formatDate(airDate)}</span>}
    </div>
  );
}

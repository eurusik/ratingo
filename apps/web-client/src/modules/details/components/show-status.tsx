/**
 * Show status: Season progress + next episode.
 */

import { Calendar, Clapperboard } from 'lucide-react';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';

export interface ShowStatusProps {
  currentSeason?: number;
  currentSeasonEpisodesReleased?: number;
  currentSeasonTotalEpisodes?: number;
  nextEpisodeDate?: string | null;
  status?: 'Returning Series' | 'Ended' | 'Canceled' | 'In Production';
  dict: ReturnType<typeof getDictionary>;
}

export function ShowStatus({
  currentSeason,
  currentSeasonEpisodesReleased,
  currentSeasonTotalEpisodes,
  nextEpisodeDate,
  status,
  dict,
}: ShowStatusProps) {

  return (
    <section className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-400 mb-3">
        {dict.details.showStatus.title}
      </h2>
      <div className="space-y-2 text-white">
        {/* Season progress */}
        {currentSeason && currentSeasonTotalEpisodes && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span>
              {dict.details.showStatus.season} {currentSeason}:
              <span className="text-zinc-400 ml-1">
                {currentSeasonEpisodesReleased ?? 0} {dict.details.showStatus.of} {currentSeasonTotalEpisodes} {dict.details.showStatus.episodes} {dict.details.showStatus.episodesReleased}
              </span>
            </span>
          </div>
        )}

        {/* Next episode */}
        {nextEpisodeDate && (
          <div className="flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-purple-400" />
            <span>
              {dict.details.showStatus.nextEpisode}:
              <span className="text-purple-400 ml-1 font-medium">
                {formatDate(nextEpisodeDate)}
              </span>
            </span>
          </div>
        )}

        {/* Status for ended shows */}
        {!nextEpisodeDate && status === 'Ended' && (
          <div className="text-zinc-400">{dict.details.showStatus.ended}</div>
        )}
        {!nextEpisodeDate && status === 'Canceled' && (
          <div className="text-zinc-400">{dict.details.showStatus.canceled}</div>
        )}
      </div>
    </section>
  );
}

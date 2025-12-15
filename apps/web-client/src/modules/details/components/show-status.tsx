/**
 * Show status: Season progress + next episode.
 * Redesigned for clean, informative, beautiful UI.
 * Color scheme: unified blue for consistency.
 */

import { Calendar, Clock } from 'lucide-react';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';

export interface ShowStatusProps {
  currentSeason?: number;
  currentSeasonEpisodesReleased?: number;
  currentSeasonTotalEpisodes?: number;
  nextEpisodeDate?: string | null;
  status?: 'Returning Series' | 'Ended' | 'Canceled' | 'In Production';
  totalSeasons?: number;
  totalEpisodes?: number;
  dict: ReturnType<typeof getDictionary>;
}

export function ShowStatus({
  currentSeason,
  currentSeasonEpisodesReleased,
  currentSeasonTotalEpisodes,
  nextEpisodeDate,
  status,
  totalSeasons,
  totalEpisodes,
  dict,
}: ShowStatusProps) {
  const episodesReleased = currentSeasonEpisodesReleased ?? 0;
  const progress = currentSeasonTotalEpisodes 
    ? (episodesReleased / currentSeasonTotalEpisodes) * 100 
    : 0;

  return (
    <section className="bg-zinc-900/30 rounded-2xl p-4 border border-zinc-800/50">
      <div className="space-y-3">
        {/* Total seasons/episodes summary */}
        {totalSeasons && totalEpisodes && (
          <div className="text-sm text-zinc-400">
            <span className="font-medium">{totalSeasons}</span> {totalSeasons === 1 ? 'сезон' : totalSeasons < 5 ? 'сезони' : 'сезонів'}
            <span className="text-zinc-600 mx-1.5">•</span>
            <span className="font-medium">{totalEpisodes}</span> {totalEpisodes === 1 ? 'епізод' : totalEpisodes < 5 ? 'епізоди' : 'епізодів'}
          </div>
        )}

        {/* Season progress with bar */}
        {currentSeason && currentSeasonTotalEpisodes && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-white">
                  {dict.details.showStatus.season} {currentSeason}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                <span className="text-blue-400">{episodesReleased}</span>
                <span className="text-zinc-600 mx-1">/</span>
                <span className="text-zinc-400">{currentSeasonTotalEpisodes}</span>
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="relative h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Next episode */}
        {nextEpisodeDate && (
          <div className="flex items-center gap-2 pt-0.5">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-zinc-400">
              {dict.details.showStatus.nextEpisode}:
            </span>
            <span className="text-sm text-blue-400 font-medium">
              {formatDate(nextEpisodeDate)}
            </span>
          </div>
        )}

        {/* Status for ended shows */}
        {!nextEpisodeDate && status === 'Ended' && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            {dict.details.showStatus.ended}
          </div>
        )}
        {!nextEpisodeDate && status === 'Canceled' && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
            {dict.details.showStatus.canceled}
          </div>
        )}
      </div>
    </section>
  );
}

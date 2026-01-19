/**
 * Show status: Seasons/episodes count + next episode date.
 * Clean, minimal display using API data directly.
 */

import { Clock } from 'lucide-react';
import type { getDictionary } from '@/shared/i18n';
import { formatDate, pluralize } from '@/shared/utils';

export interface ShowStatusProps {
  nextEpisodeDate?: string | null;
  totalSeasons?: number;
  totalEpisodes?: number;
  dict: ReturnType<typeof getDictionary>;
}

export function ShowStatus({
  nextEpisodeDate,
  totalSeasons,
  totalEpisodes,
  dict,
}: ShowStatusProps) {
  // Don't render if no data
  if (!totalSeasons && !totalEpisodes && !nextEpisodeDate) {
    return null;
  }

  return (
    <section className="bg-cinema-card/30 rounded-2xl p-5 border border-cinema-borderSoft/50">
      <div className="space-y-4">
        {/* Total seasons/episodes summary */}
        {totalSeasons !== undefined && totalEpisodes !== undefined && (
          <div className="text-base text-cinema-text-secondary">
            <span className="font-medium">{totalSeasons}</span>{' '}
            {pluralize(totalSeasons, dict.details.showStatus.plurals.season)}
            <span className="text-cinema-text-disabled mx-2">•</span>
            <span className="font-medium">{totalEpisodes}</span>{' '}
            {pluralize(totalEpisodes, dict.details.showStatus.plurals.episode)}
          </div>
        )}

        {/* Next episode */}
        {nextEpisodeDate && (
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-sm text-cinema-text-muted">{dict.details.showStatus.nextEpisode}:</span>
            <span className="text-sm text-blue-400 font-medium">{formatDate(nextEpisodeDate)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

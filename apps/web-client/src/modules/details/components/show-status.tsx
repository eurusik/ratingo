/**
 * Show status: Seasons/episodes count + next episode date.
 * Clean, minimal display using API data directly.
 */

import { Clock } from 'lucide-react';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';

export interface ShowStatusProps {
  nextEpisodeDate?: string | null;
  totalSeasons?: number;
  totalEpisodes?: number;
  dict: ReturnType<typeof getDictionary>;
}

/**
 * Pluralizes words using Intl.PluralRules API.
 * Supports proper plural forms for Ukrainian and other languages.
 */
function pluralize(
  count: number,
  forms: { one: string; few: string; many: string },
  locale: string = 'uk'
): string {
  const pr = new Intl.PluralRules(locale);
  const rule = pr.select(count);
  return forms[rule as keyof typeof forms] ?? forms.many;
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
    <section className="bg-zinc-900/30 rounded-2xl p-5 border border-zinc-800/50">
      <div className="space-y-4">
        {/* Total seasons/episodes summary */}
        {totalSeasons !== undefined && totalEpisodes !== undefined && (
          <div className="text-base text-zinc-300">
            <span className="font-medium">{totalSeasons}</span>{' '}
            {pluralize(totalSeasons, dict.details.showStatus.plurals.season)}
            <span className="text-zinc-600 mx-2">•</span>
            <span className="font-medium">{totalEpisodes}</span>{' '}
            {pluralize(totalEpisodes, dict.details.showStatus.plurals.episode)}
          </div>
        )}

        {/* Next episode */}
        {nextEpisodeDate && (
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-sm text-zinc-400">
              {dict.details.showStatus.nextEpisode}:
            </span>
            <span className="text-sm text-blue-400 font-medium">
              {formatDate(nextEpisodeDate)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Movie release info: Runtime + Theater + Digital dates.
 */

import { Calendar, Clapperboard, Clock, Tv } from 'lucide-react';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';

export interface MovieReleaseProps {
  releaseDate?: string | null;
  digitalReleaseDate?: string | null;
  runtime?: number | null;
  status?: 'Released' | 'Post Production' | 'In Production' | 'Rumored';
  dict: ReturnType<typeof getDictionary>;
}

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}г ${mins}хв` : `${mins}хв`;
}

function isSameDate(date1?: string | null, date2?: string | null): boolean {
  if (!date1 || !date2) return false;
  return date1.slice(0, 10) === date2.slice(0, 10);
}

export function MovieRelease({
  releaseDate,
  digitalReleaseDate,
  runtime,
  status,
  dict,
}: MovieReleaseProps) {
  const datesMatch = isSameDate(releaseDate, digitalReleaseDate);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
        {dict.details.movieRelease.title}
      </h2>

      <div className="space-y-1.5 text-sm">
        {/* Runtime */}
        {runtime && runtime > 0 && (
          <div className="flex items-center gap-2 text-zinc-300">
            <Clock className="w-4 h-4 text-zinc-500" />
            <span>{formatRuntime(runtime)}</span>
          </div>
        )}

        {/* Combined release (if dates match) */}
        {datesMatch && releaseDate && (
          <div className="flex items-center gap-2 text-zinc-300">
            <div className="flex items-center gap-0.5">
              <Clapperboard className="w-4 h-4 text-zinc-500" />
              <Tv className="w-4 h-4 text-zinc-500" />
            </div>
            <span>{dict.details.movieRelease.combinedRelease} {formatDate(releaseDate)}</span>
          </div>
        )}

        {/* Separate theater release */}
        {!datesMatch && releaseDate && (
          <div className="flex items-center gap-2 text-zinc-300">
            <Clapperboard className="w-4 h-4 text-zinc-500" />
            <span>{dict.details.movieRelease.theaterPrefix} {formatDate(releaseDate)}</span>
          </div>
        )}

        {/* Separate digital release */}
        {!datesMatch && digitalReleaseDate && (
          <div className="flex items-center gap-2 text-zinc-300">
            <Tv className="w-4 h-4 text-zinc-500" />
            <span>{dict.details.movieRelease.digitalPrefix} {formatDate(digitalReleaseDate)}</span>
          </div>
        )}

        {/* Status for unreleased */}
        {!releaseDate && status && status !== 'Released' && (
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span>
              {status === 'In Production' && dict.details.movieRelease.inProduction}
              {status === 'Post Production' && dict.details.movieRelease.postProduction}
              {status === 'Rumored' && dict.details.movieRelease.rumored}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

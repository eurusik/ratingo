/**
 * Movie release info: Theater + Digital dates.
 *
 */

import { Calendar, Film } from 'lucide-react';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';

export interface MovieReleaseProps {
  releaseDate?: string | null;
  digitalReleaseDate?: string | null;
  status?: 'Released' | 'Post Production' | 'In Production' | 'Rumored';
  dict: ReturnType<typeof getDictionary>;
}

export function MovieRelease({
  releaseDate,
  digitalReleaseDate,
  status,
  dict,
}: MovieReleaseProps) {

  return (
    <section className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-400 mb-3">
        {dict.details.movieRelease.title}
      </h2>
      <div className="space-y-2 text-white">
        {/* Theater release */}
        {releaseDate && (
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-zinc-500" />
            <span>
              {dict.details.movieRelease.theaters}:
              <span className="text-zinc-300 ml-1 font-medium">
                {formatDate(releaseDate)}
              </span>
            </span>
          </div>
        )}

        {/* Digital release */}
        {digitalReleaseDate && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <span>
              {dict.details.movieRelease.digital}:
              <span className="text-purple-400 ml-1 font-medium">
                {formatDate(digitalReleaseDate)}
              </span>
            </span>
          </div>
        )}

        {/* Status for unreleased */}
        {!releaseDate && status && status !== 'Released' && (
          <div className="text-zinc-400">
            {status === 'In Production' && dict.details.movieRelease.inProduction}
            {status === 'Post Production' && dict.details.movieRelease.postProduction}
            {status === 'Rumored' && dict.details.movieRelease.rumored}
          </div>
        )}
      </div>
    </section>
  );
}

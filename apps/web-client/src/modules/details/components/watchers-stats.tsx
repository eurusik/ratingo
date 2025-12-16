/**
 * Watchers statistics display.
 * Shows live watchers and total watchers counts.
 */

import { Eye, Users } from 'lucide-react';
import type { Stats } from '../types';

interface WatchersStatsProps {
  stats: Stats;
  dict: {
    watchingNow: string;
    totalWatchers: string;
  };
}

export function WatchersStats({ stats, dict }: WatchersStatsProps) {
  const hasLiveWatchers = stats.liveWatchers != null && stats.liveWatchers > 0;
  const hasTotalWatchers = stats.totalWatchers != null && stats.totalWatchers > 0;

  if (!hasLiveWatchers && !hasTotalWatchers) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 md:gap-6 flex-wrap">
      {/* Live watchers */}
      {hasLiveWatchers && (
        <div className="flex items-center gap-2 text-zinc-300">
          <Eye className="w-5 h-5 text-blue-400" />
          <span className="text-base font-medium">
            {stats.liveWatchers!.toLocaleString()}
          </span>
          <span className="text-sm text-zinc-400">{dict.watchingNow}</span>
        </div>
      )}

      {/* Total watchers */}
      {hasTotalWatchers && (
        <div className="flex items-center gap-2 text-zinc-400">
          <Users className="w-5 h-5 text-zinc-500" />
          <span className="text-base font-medium">
            {stats.totalWatchers!.toLocaleString()}
          </span>
          <span className="text-sm text-zinc-400">{dict.totalWatchers}</span>
        </div>
      )}
    </div>
  );
}

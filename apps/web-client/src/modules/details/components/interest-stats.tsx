/**
 * Interest stats — quiet row showing activity dynamics.
 * Displays: live watchers + total watchers
 * Lower contrast than badges, serves as "service info".
 */

import { TrendingUp, Users } from 'lucide-react';
import type { Stats } from '../types';

interface InterestStatsProps {
  stats?: Stats | null;
  watchingNowLabel: string;
  totalWatchersLabel: string;
}

export function InterestStats({ stats, watchingNowLabel, totalWatchersLabel }: InterestStatsProps) {
  const hasLiveWatchers = stats?.liveWatchers != null && stats.liveWatchers > 0;
  const hasTotalWatchers = stats?.totalWatchers != null && stats.totalWatchers > 0;

  if (!hasLiveWatchers && !hasTotalWatchers) return null;

  return (
    <div className="flex items-center gap-4 text-xs text-cinema-text-muted">
      {hasLiveWatchers && (
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-cinema-text-muted" />
          <span className="text-cinema-text-muted">{stats!.liveWatchers!.toLocaleString()}</span>
          <span>{watchingNowLabel}</span>
        </span>
      )}

      {hasLiveWatchers && hasTotalWatchers && <span className="text-cinema-text-disabled">·</span>}

      {hasTotalWatchers && (
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-cinema-text-disabled" />
          <span className="text-cinema-text-muted">{stats!.totalWatchers!.toLocaleString()}</span>
          <span>{totalWatchersLabel}</span>
        </span>
      )}
    </div>
  );
}

'use client';

import { Button, Meter } from '@heroui/react';
import { CheckCheck } from 'lucide-react';
import { isSeasonDone, seasonProgress, type Season } from '@/entities/episode';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { EpisodesTracker } from '../model/use-episodes-tracker';

interface SeasonSummaryProps {
  season: Season;
  tracker: EpisodesTracker;
  onMarkSeason: () => void;
}

export function SeasonSummary({ season, tracker, onMarkSeason }: SeasonSummaryProps) {
  const { dict } = useTranslation();
  const count = seasonProgress(season, tracker.watched, tracker.now);
  const isDone = isSeasonDone(count);
  const text = isDone
    ? interpolate(dict.episodes.seasonWatched, { number: season.number })
    : interpolate(dict.episodes.seasonProgress, { number: season.number, ...count });

  return (
    <div className="flex flex-col gap-2 border-b border-separator pb-3">
      <div className="flex min-h-11 items-center gap-2.5">
        <span className="flex-1 text-sm font-semibold tabular-nums">{text}</span>
        {isDone || count.aired === 0 ? null : (
          <Button
            variant="outline"
            size="sm"
            onPress={onMarkSeason}
            className="h-11 gap-1.5 rounded-full font-semibold"
          >
            <CheckCheck aria-hidden className="size-4" />
            {dict.episodes.markSeason}
          </Button>
        )}
      </div>
      <Meter
        aria-label={interpolate(dict.episodes.seasonProgressLabel, { number: season.number })}
        value={count.watched}
        maxValue={Math.max(count.aired, 1)}
        size="sm"
        color={isDone ? 'success' : 'accent'}
        className="hidden md:grid"
      >
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
    </div>
  );
}

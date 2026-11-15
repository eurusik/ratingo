'use client';

import { useEffect, useRef, useState } from 'react';
import { hasAired, type Season } from '@/entities/episode';

export type SlideDirection = 'forward' | 'back';

const ADVANCE_DELAY_MS = 650;

export function followingSeason(
  seasons: readonly Season[],
  season: Season,
  now: number,
  isComplete: (season: Season) => boolean,
): Season | undefined {
  return seasons.find(
    (candidate) =>
      candidate.number > season.number &&
      !isComplete(candidate) &&
      candidate.episodes.some((episode) => hasAired(episode, now)),
  );
}

export interface SeasonNavigation {
  season: Season;
  direction?: SlideDirection;
  select: (seasonNumber: number) => void;
}

interface SeasonNavigationOptions {
  seasons: Season[];
  initial: number | (() => number);
  now: number;
  isComplete: (season: Season) => boolean;
}

export function useSeasonNavigation({
  seasons,
  initial,
  now,
  isComplete,
}: SeasonNavigationOptions): SeasonNavigation {
  const [current, setCurrent] = useState(initial);
  const [direction, setDirection] = useState<SlideDirection>();
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const season =
    seasons.find((candidate) => candidate.number === current) ?? seasons[seasons.length - 1];
  const isSeasonComplete = isComplete(season);
  const lastSeen = useRef({ number: season.number, isComplete: isSeasonComplete });

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  useEffect(() => {
    const previous = lastSeen.current;
    lastSeen.current = { number: season.number, isComplete: isSeasonComplete };
    if (!isSeasonComplete) clearTimeout(advanceTimer.current);
    const justCompleted =
      previous.number === season.number && !previous.isComplete && isSeasonComplete;
    if (!justCompleted) return;
    const next = followingSeason(seasons, season, now, isComplete);
    if (!next) return;
    advanceTimer.current = setTimeout(() => {
      setDirection('forward');
      setCurrent(next.number);
    }, ADVANCE_DELAY_MS);
  }, [season, isSeasonComplete, seasons, now, isComplete]);

  const select = (seasonNumber: number) => {
    clearTimeout(advanceTimer.current);
    if (seasonNumber === season.number) return;
    setDirection(seasonNumber > season.number ? 'forward' : 'back');
    setCurrent(seasonNumber);
  };

  return { season, direction, select };
}

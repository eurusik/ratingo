'use client';

import { ToggleButton, ToggleButtonGroup, type Key } from '@heroui/react';
import { Check } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { isSeasonDone, seasonProgress, type Season } from '@/entities/episode';
import { interpolate, useTranslation } from '@/shared/i18n';
import { EdgeFade, useHorizontalScroller } from '@/shared/ui';
import type { EpisodesTracker } from '../model/use-episodes-tracker';

interface SeasonTilesProps {
  seasons: Season[];
  selected: number;
  onSelect: (seasonNumber: number) => void;
  tracker: EpisodesTracker;
}

const PERCENT = 100;
function SeasonTile({ season, tracker }: { season: Season; tracker: EpisodesTracker }) {
  const { dict } = useTranslation();
  const count = seasonProgress(season, tracker.watched, tracker.now);
  const { watched, aired } = count;
  const isDone = isSeasonDone(count);
  const filled = aired === 0 ? 0 : Math.round((watched / aired) * PERCENT);

  return (
    <ToggleButton
      id={String(season.number)}
      aria-label={interpolate(dict.episodes.seasonAria, { number: season.number, watched, aired })}
      className="h-15 w-14 shrink-0 flex-col gap-1.5 rounded-[14px] border-2 border-default bg-transparent px-0 pt-1.5 pb-0 data-[selected=true]:border-accent data-[selected=true]:bg-default"
    >
      <span className="text-[11px] leading-none font-semibold text-muted">
        {dict.episodes.seasonTab}
      </span>
      <span className="flex items-center gap-0.5 text-lg leading-none font-extrabold tabular-nums">
        {season.number}
        {isDone ? <Check aria-hidden className="size-3 text-success" strokeWidth={3.4} /> : null}
      </span>
      <span aria-hidden className="block h-[3px] w-8 overflow-hidden rounded-full bg-default">
        <span
          className={cn(
            'block h-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none',
            isDone ? 'bg-success' : 'bg-accent',
          )}
          style={{ width: `${filled}%` }}
        />
      </span>
    </ToggleButton>
  );
}

export function SeasonTiles({ seasons, selected, onSelect, tracker }: SeasonTilesProps) {
  const { dict } = useTranslation();
  const { ref: groupRef, edges } = useHorizontalScroller<HTMLDivElement>({
    activeKey: String(selected),
    contentKey: String(seasons.length),
    activeSelector: '[data-selected="true"]',
  });

  const changeSeason = (keys: Set<Key>) => {
    const [key] = keys;
    if (key !== undefined) onSelect(Number(key));
  };

  return (
    <div data-noswipe className="relative -mx-4 md:mx-0">
      <ToggleButtonGroup
        ref={groupRef}
        aria-label={dict.episodes.seasonsLabel}
        selectionMode="single"
        disallowEmptySelection
        isDetached
        selectedKeys={[String(selected)]}
        onSelectionChange={changeSeason}
        className="flex w-full min-w-0 flex-nowrap justify-start gap-2 overflow-x-auto overscroll-x-contain scroll-px-10 px-4 py-0.5 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {seasons.map((season) => (
          <SeasonTile key={season.number} season={season} tracker={tracker} />
        ))}
      </ToggleButtonGroup>
      <EdgeFade side="start" isVisible={edges.hasMoreBefore} tone="overlay" />
      <EdgeFade side="end" isVisible={edges.hasMoreAfter} tone="overlay" />
    </div>
  );
}

'use client';

import { memo } from 'react';
import { cn } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { episodeCode, episodeKey, episodeShortCode } from '../model/episode-code';
import { episodeMeta, episodeTitle } from '../model/episode-format';
import type { Episode } from '../model/season';
import { NextBadge, TvMazeRating } from './episode-badges';
import {
  OpenRowButton,
  PickToggle,
  StillDetailButton,
  WatchedButton,
} from './episode-row-controls';
import { EpisodeStill } from './episode-still';

interface EpisodeRowProps {
  episode: Episode;
  isAired: boolean;
  isNext?: boolean;
  isWatched?: boolean;
  isPicked?: boolean;
  isOpened?: boolean;
  onWatchedChange?: (episode: Episode, watched: boolean) => void;
  onPick?: (episode: Episode) => void;
  onOpen?: (episode: Episode) => void;
  onOpenIntent?: (episode: Episode) => void;
  onMenu?: (episode: Episode, anchor: Element) => void;
}

export function episodeRowSelector(episode: Pick<Episode, 'seasonNumber' | 'number'>): string {
  return `[data-episode-key="${episodeKey(episode)}"]`;
}

type EpisodeState = Required<Pick<EpisodeRowProps, 'episode' | 'isAired' | 'isNext' | 'isWatched'>>;

const ROW = 'flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-start';

function EpisodeText({ episode, isAired, isNext, isWatched }: EpisodeState) {
  const { dict, locale } = useTranslation();
  const meta = episodeMeta(episode, isAired, dict, locale);

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn('truncate text-[15px] leading-snug font-bold', isWatched && 'text-muted')}
        >
          {episodeTitle(episode, dict)}
        </span>
        {isNext ? <NextBadge /> : null}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted tabular-nums">
        {meta ? <span className="truncate">{meta}</span> : null}
        {isAired && episode.rating !== undefined ? <TvMazeRating rating={episode.rating} /> : null}
      </span>
    </span>
  );
}

type RowMode = 'pick' | 'mark' | 'open' | 'static';

function rowMode(
  props: Pick<EpisodeRowProps, 'isAired' | 'onPick' | 'onWatchedChange' | 'onOpen'>,
): RowMode {
  if (props.onPick) return 'pick';
  if (props.onWatchedChange && props.isAired) return 'mark';
  if (props.onOpen) return 'open';
  return 'static';
}

export const EpisodeRow = memo(function EpisodeRow(props: EpisodeRowProps) {
  const {
    episode,
    isAired,
    isNext = false,
    isWatched = false,
    isPicked = false,
    isOpened = false,
    onWatchedChange,
    onPick,
    onOpen,
    onOpenIntent,
    onMenu,
  } = props;
  const { dict } = useTranslation();
  const labelValues = { code: episodeCode(episode, dict), title: episodeTitle(episode, dict) };
  const label = interpolate(dict.episodes.episodeAria, labelValues);
  const openLabel = interpolate(dict.episodes.detail.open, labelValues);
  const mode = rowMode(props);
  const isDimmed = !isAired || (mode === 'pick' && isWatched);
  const open = onOpen ? () => onOpen(episode) : undefined;
  const showIntent = onOpenIntent ? () => onOpenIntent(episode) : undefined;

  return (
    <li
      data-episode-key={episodeKey(episode)}
      className={cn(
        'relative -mx-2 rounded-2xl',
        isDimmed && 'opacity-60',
        (isPicked || isOpened) && 'bg-accent-soft',
      )}
    >
      <div className={cn(ROW, mode !== 'static' && 'pe-16')}>
        <span className={cn('flex shrink-0 rounded-[10px]', isOpened && 'ring-2 ring-accent')}>
          <EpisodeStill
            episode={episode}
            badge={episodeShortCode(episode, dict)}
            size="row"
            isDimmed={isWatched}
          />
        </span>
        <EpisodeText episode={episode} isAired={isAired} isNext={isNext} isWatched={isWatched} />
      </div>
      {mode === 'pick' && onPick ? (
        <PickToggle
          label={label}
          isMarked={isPicked || isWatched}
          isDisabled={!isAired || isWatched}
          onPick={() => onPick(episode)}
        />
      ) : null}
      {mode === 'mark' && onWatchedChange ? (
        <WatchedButton
          label={label}
          isWatched={isWatched}
          onWatchedChange={(watched) => onWatchedChange(episode, watched)}
          onMenu={onMenu ? (anchor) => onMenu(episode, anchor) : undefined}
        />
      ) : null}
      {mode === 'mark' && open ? (
        <StillDetailButton label={openLabel} onOpen={open} onIntent={showIntent} />
      ) : null}
      {mode === 'open' && open ? (
        <OpenRowButton label={openLabel} onOpen={open} onIntent={showIntent} />
      ) : null}
    </li>
  );
});

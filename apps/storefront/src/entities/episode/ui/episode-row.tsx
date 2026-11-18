'use client';

import { memo } from 'react';
import { Checkbox, ToggleButton } from '@heroui/react';
import { Check } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';
import { episodeCode, episodeShortCode } from '../model/episode-code';
import { episodeMeta, episodeTitle } from '../model/episode-format';
import type { Episode } from '../model/season';
import { EpisodeStill } from './episode-still';

const HIGH_RATING = 8.5;

interface EpisodeRowProps {
  episode: Episode;
  isAired: boolean;
  isNext?: boolean;
  isWatched?: boolean;
  isPicked?: boolean;
  onWatchedChange?: (episode: Episode, watched: boolean) => void;
  onPick?: (episode: Episode) => void;
}

type EpisodeState = Required<Pick<EpisodeRowProps, 'episode' | 'isAired' | 'isNext' | 'isWatched'>>;

const ROW = 'flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-start';

function TvMazeRating({ rating }: { rating: number }) {
  const { locale } = useTranslation();
  const score = formatScore(locale, rating);

  return (
    <span
      role="img"
      aria-label={`TVMaze ${score}`}
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-default ps-0.5 pe-1.5 text-xs font-extrabold',
        rating >= HIGH_RATING ? 'text-success' : 'text-foreground',
      )}
    >
      <span
        aria-hidden
        className="inline-flex size-3.5 items-center justify-center rounded bg-[#3c948b] text-[9px] font-black text-white"
      >
        TV
      </span>
      {score}
    </span>
  );
}

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
        {isNext ? (
          <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-accent-soft px-2 text-[11px] font-extrabold text-accent">
            {dict.episodes.next}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted tabular-nums">
        {meta ? <span className="truncate">{meta}</span> : null}
        {isAired && episode.rating !== undefined ? <TvMazeRating rating={episode.rating} /> : null}
      </span>
    </span>
  );
}

function CheckMark({ isOn }: { isOn: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
        isOn ? 'border-accent bg-accent text-accent-foreground' : 'border-muted/40',
      )}
    >
      {isOn ? <Check className="size-5" strokeWidth={2.8} /> : null}
    </span>
  );
}

const PICK_OVERLAY =
  'absolute inset-0 h-auto w-auto justify-end rounded-2xl px-0 pe-2 transform-none active:transform-none data-[pressed=true]:transform-none [--toggle-button-bg-hover:transparent] [--toggle-button-bg-pressed:transparent] [--toggle-button-bg-selected-hover:transparent] [--toggle-button-bg-selected-pressed:transparent] [--toggle-button-bg-selected:transparent] [--toggle-button-fg-selected:currentColor] [&_svg]:size-5';

interface RowControlProps {
  label: string;
  isAired: boolean;
  isWatched: boolean;
  isPicked: boolean;
  onWatchedChange?: (watched: boolean) => void;
  onPick?: () => void;
}

function RowControl({
  label,
  isAired,
  isWatched,
  isPicked,
  onWatchedChange,
  onPick,
}: RowControlProps) {
  if (onPick) {
    const isMarked = isPicked || isWatched;
    return (
      <ToggleButton
        variant="ghost"
        aria-label={label}
        isSelected={isMarked}
        isDisabled={!isAired || isWatched}
        onChange={onPick}
        className={PICK_OVERLAY}
      >
        <CheckMark isOn={isMarked} />
      </ToggleButton>
    );
  }

  if (!onWatchedChange || !isAired) return null;

  return (
    <Checkbox
      aria-label={label}
      isSelected={isWatched}
      onChange={onWatchedChange}
      className="absolute inset-0 [&_[data-slot='checkbox-default-indicator--checkmark']]:size-5"
    >
      <Checkbox.Content className="flex size-full cursor-pointer items-center justify-end rounded-2xl pe-2 transition-colors select-none hover:bg-default/40">
        <Checkbox.Control className="size-11 shrink-0 rounded-full border-2 border-muted/40 bg-transparent before:rounded-full in-data-[selected=true]:border-accent">
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

export const EpisodeRow = memo(function EpisodeRow({
  episode,
  isAired,
  isNext = false,
  isWatched = false,
  isPicked = false,
  onWatchedChange,
  onPick,
}: EpisodeRowProps) {
  const { dict } = useTranslation();
  const label = interpolate(dict.episodes.episodeAria, {
    code: episodeCode(episode, dict),
    title: episodeTitle(episode, dict),
  });
  const hasControl = onPick !== undefined || (onWatchedChange !== undefined && isAired);
  const isDimmed = !isAired || (onPick !== undefined && isWatched);

  return (
    <li
      className={cn(
        'relative -mx-2 rounded-2xl',
        isDimmed && 'opacity-60',
        isPicked && 'bg-accent-soft',
      )}
    >
      <div className={cn(ROW, hasControl && 'pe-16')}>
        <EpisodeStill
          episode={episode}
          badge={episodeShortCode(episode, dict)}
          size="row"
          isDimmed={isWatched}
        />
        <EpisodeText episode={episode} isAired={isAired} isNext={isNext} isWatched={isWatched} />
      </div>
      <RowControl
        label={label}
        isAired={isAired}
        isWatched={isWatched}
        isPicked={isPicked}
        onWatchedChange={
          onWatchedChange ? (watched) => onWatchedChange(episode, watched) : undefined
        }
        onPick={onPick ? () => onPick(episode) : undefined}
      />
    </li>
  );
});

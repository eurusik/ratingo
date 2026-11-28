'use client';

import { memo } from 'react';
import { Checkbox, ToggleButton } from '@heroui/react';
import { Check } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { episodeCode, episodeKey, episodeShortCode } from '../model/episode-code';
import { episodeMeta, episodeTitle } from '../model/episode-format';
import type { Episode } from '../model/season';
import { NextBadge, TvMazeRating } from './episode-badges';
import { EpisodeStill } from './episode-still';

interface EpisodeRowProps {
  episode: Episode;
  isAired: boolean;
  isNext?: boolean;
  isWatched?: boolean;
  isPicked?: boolean;
  onWatchedChange?: (episode: Episode, watched: boolean) => void;
  onPick?: (episode: Episode) => void;
  onOpen?: (episode: Episode) => void;
  onOpenIntent?: (episode: Episode) => void;
}

export function episodeRowSelector(episode: Pick<Episode, 'seasonNumber' | 'number'>): string {
  return `[data-episode-key="${episodeKey(episode)}"]`;
}

type ControlLayout = 'overlay' | 'inline';

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

const CHECKBOX_INDICATOR = "[&_[data-slot='checkbox-default-indicator--checkmark']]:size-5";
const CHECKBOX_CONTROL =
  'size-11 shrink-0 rounded-full border-2 border-muted/40 bg-transparent before:rounded-full in-data-[selected=true]:border-accent';

const CHECKBOX_LAYOUT: Record<ControlLayout, { root: string; content: string }> = {
  overlay: {
    root: 'absolute inset-0',
    content: 'size-full pe-2 transition-colors hover:bg-default/40',
  },
  inline: { root: 'relative shrink-0 pe-2', content: 'size-11' },
};

interface WatchedCheckboxProps {
  label: string;
  isWatched: boolean;
  layout: ControlLayout;
  onWatchedChange: (watched: boolean) => void;
}

function WatchedCheckbox({ label, isWatched, layout, onWatchedChange }: WatchedCheckboxProps) {
  return (
    <Checkbox
      aria-label={label}
      isSelected={isWatched}
      onChange={onWatchedChange}
      className={cn(CHECKBOX_LAYOUT[layout].root, CHECKBOX_INDICATOR)}
    >
      <Checkbox.Content
        className={cn(
          'flex cursor-pointer items-center justify-end rounded-2xl select-none',
          CHECKBOX_LAYOUT[layout].content,
        )}
      >
        <Checkbox.Control className={CHECKBOX_CONTROL}>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

interface RowControlProps {
  label: string;
  isAired: boolean;
  isWatched: boolean;
  isPicked: boolean;
  layout: ControlLayout;
  onWatchedChange?: (watched: boolean) => void;
  onPick?: () => void;
}

function RowControl({
  label,
  isAired,
  isWatched,
  isPicked,
  layout,
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
    <WatchedCheckbox
      label={label}
      isWatched={isWatched}
      layout={layout}
      onWatchedChange={onWatchedChange}
    />
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
  onOpen,
  onOpenIntent,
}: EpisodeRowProps) {
  const { dict } = useTranslation();
  const labelValues = { code: episodeCode(episode, dict), title: episodeTitle(episode, dict) };
  const label = interpolate(dict.episodes.episodeAria, labelValues);
  const opensDetail = onOpen !== undefined && onPick === undefined;
  const hasOverlay =
    onPick !== undefined || (!opensDetail && onWatchedChange !== undefined && isAired);
  const showIntent = onOpenIntent ? () => onOpenIntent(episode) : undefined;
  const isDimmed = !isAired || (onPick !== undefined && isWatched);
  const content = (
    <>
      <EpisodeStill
        episode={episode}
        badge={episodeShortCode(episode, dict)}
        size="row"
        isDimmed={isWatched}
      />
      <EpisodeText episode={episode} isAired={isAired} isNext={isNext} isWatched={isWatched} />
    </>
  );

  return (
    <li
      data-episode-key={episodeKey(episode)}
      className={cn(
        'relative -mx-2 rounded-2xl',
        opensDetail && 'flex items-center',
        isDimmed && 'opacity-60',
        isPicked && 'bg-accent-soft',
      )}
    >
      {opensDetail ? (
        <button
          type="button"
          aria-label={interpolate(dict.episodes.detail.open, labelValues)}
          onClick={() => onOpen(episode)}
          onPointerEnter={showIntent}
          onFocus={showIntent}
          className={cn(ROW, 'min-w-0 flex-1 cursor-pointer transition-colors hover:bg-default/40')}
        >
          {content}
        </button>
      ) : (
        <div className={cn(ROW, hasOverlay && 'pe-16')}>{content}</div>
      )}
      <RowControl
        label={label}
        isAired={isAired}
        isWatched={isWatched}
        isPicked={isPicked}
        layout={opensDetail ? 'inline' : 'overlay'}
        onWatchedChange={
          onWatchedChange ? (watched) => onWatchedChange(episode, watched) : undefined
        }
        onPick={onPick ? () => onPick(episode) : undefined}
      />
    </li>
  );
});

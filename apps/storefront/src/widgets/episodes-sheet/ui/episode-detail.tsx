'use client';

import { useEffect, useId, useRef } from 'react';
import { Button, ToggleButton } from '@heroui/react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import {
  EpisodeStill,
  NextBadge,
  TvMazeRating,
  episodeCode,
  episodeKey,
  episodeShortCode,
  episodeTitle,
  formatAirDate,
  hasAired,
  isOverviewSpoiler,
  useEpisodeOverview,
  type Episode,
  type Season,
} from '@/entities/episode';
import { interpolate, useTranslation } from '@/shared/i18n';
import { episodeNeighbours } from '../model/episode-neighbours';
import type { EpisodesTracker } from '../model/use-episodes-tracker';
import { EpisodeOverviewBlock } from './episode-overview-block';
import { NoticeBar } from './notice-bar';

interface EpisodeDetailProps {
  showSlug: string;
  seasons: Season[];
  episode: Episode;
  tracker: EpisodesTracker;
  onOpen: (episode: Episode) => void;
  onBack: () => void;
  onClose: () => void;
}

function EpisodeFacts({ episode }: { episode: Episode }) {
  const { dict, locale } = useTranslation();
  const date = episode.airDate ? formatAirDate(locale, episode.airDate) : undefined;
  const runtime =
    episode.runtimeMinutes === undefined
      ? undefined
      : interpolate(dict.details.runtime.minutes, { minutes: episode.runtimeMinutes });
  const meta = [date ?? dict.episodes.dateUnknown, runtime].filter(Boolean).join(' · ');

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted tabular-nums">
      {meta}
      {episode.rating !== undefined ? <TvMazeRating rating={episode.rating} /> : null}
    </p>
  );
}

function WatchedToggle({
  isWatched,
  onChange,
}: {
  isWatched: boolean;
  onChange: (watched: boolean) => void;
}) {
  const { dict } = useTranslation();

  return (
    <ToggleButton
      isSelected={isWatched}
      onChange={onChange}
      className={cn(
        'h-14 w-full gap-2 rounded-full text-base font-bold',
        isWatched ? 'bg-default text-foreground' : 'bg-accent text-accent-foreground',
      )}
    >
      {isWatched ? (
        <span className="flex size-5.5 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        </span>
      ) : (
        <Check aria-hidden className="size-5" strokeWidth={2.4} />
      )}
      {isWatched ? dict.episodes.detail.watched : dict.episodes.detail.markWatched}
    </ToggleButton>
  );
}

interface NeighbourLinkProps {
  episode: Episode;
  direction: 'previous' | 'next';
  onOpen: (episode: Episode) => void;
}

function NeighbourLink({ episode, direction, onOpen }: NeighbourLinkProps) {
  const { dict } = useTranslation();
  const title = episodeTitle(episode, dict);
  const label = interpolate(dict.episodes.detail[direction], {
    code: episodeCode(episode, dict),
    title,
  });
  const isNext = direction === 'next';

  return (
    <Button
      variant="outline"
      aria-label={label}
      onPress={() => onOpen(episode)}
      className={cn(
        'h-11 min-w-0 gap-1 rounded-full font-semibold',
        isNext ? 'col-start-2 justify-end ps-3.5 pe-2' : 'justify-start ps-2 pe-3.5',
      )}
    >
      {isNext ? null : <ChevronLeft aria-hidden className="size-4.5 shrink-0 text-muted" />}
      <span aria-hidden className="shrink-0 text-muted">
        {episodeShortCode(episode, dict)}
      </span>
      <span aria-hidden className="truncate">
        {title}
      </span>
      {isNext ? <ChevronRight aria-hidden className="size-4.5 shrink-0 text-muted" /> : null}
    </Button>
  );
}

export function EpisodeDetail({
  showSlug,
  seasons,
  episode,
  tracker,
  onOpen,
  onBack,
  onClose,
}: EpisodeDetailProps) {
  const { dict } = useTranslation();
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const overview = useEpisodeOverview(showSlug, episode);
  const { previous, next } = episodeNeighbours(seasons, episode);
  const { watched, summary } = tracker;
  const isWatched = episode.id !== undefined && watched.has(episode.id);
  const canMark = episode.id !== undefined && hasAired(episode, tracker.now);
  const nextToWatch = summary.next;
  const spoilerHint = isOverviewSpoiler(episode, watched, nextToWatch)
    ? interpolate(dict.episodes.detail.spoilerHint, {
        code: nextToWatch ? episodeCode(nextToWatch, dict) : '',
      })
    : undefined;
  const key = episodeKey(episode);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ block: 'nearest' });
    headingRef.current?.focus({ preventScroll: true });
  }, [key]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className="flex flex-col gap-4 pb-[calc(1.5rem+var(--safe-bottom))]"
    >
      <div className="flex items-center justify-between gap-2.5">
        <Button
          variant="tertiary"
          onPress={onBack}
          className="h-11 gap-1 rounded-full ps-2.5 pe-4 font-semibold text-foreground"
        >
          <ChevronLeft aria-hidden className="size-5 text-muted" />
          {interpolate(dict.episodes.season, { number: episode.seasonNumber })}
        </Button>
        <Button
          isIconOnly
          variant="tertiary"
          aria-label={dict.common.close}
          onPress={onClose}
          className="size-11 rounded-full"
        >
          <X aria-hidden className="size-5" />
        </Button>
      </div>
      <EpisodeStill episode={episode} badge={episodeCode(episode, dict)} size="hero" />
      <div className="flex flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            className="text-[22px] leading-tight font-extrabold tracking-tight outline-none"
          >
            {episodeTitle(episode, dict)}
          </h2>
          {summary.next?.id === episode.id ? <NextBadge /> : null}
        </div>
        <EpisodeFacts episode={episode} />
      </div>
      <EpisodeOverviewBlock key={key} state={overview} spoilerHint={spoilerHint} />
      {canMark ? (
        <WatchedToggle
          isWatched={isWatched}
          onChange={(isSelected) => tracker.toggle(episode, isSelected)}
        />
      ) : null}
      <NoticeBar tracker={tracker} className="w-full" />
      {previous || next ? (
        <nav aria-label={dict.episodes.detail.neighbours} className="grid grid-cols-2 gap-2">
          {previous ? (
            <NeighbourLink episode={previous} direction="previous" onOpen={onOpen} />
          ) : null}
          {next ? <NeighbourLink episode={next} direction="next" onOpen={onOpen} /> : null}
        </nav>
      ) : null}
    </section>
  );
}

'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button, Meter, Skeleton } from '@heroui/react';
import { CalendarClock, Check, ChevronRight, Flag } from 'lucide-react';
import {
  EpisodeStill,
  currentSeason,
  episodeCode,
  episodeMeta,
  episodeTitle,
  formatAirDate,
  nextUpcoming,
  signedInTrackingState,
  seasonName,
  seasonProgress,
  typicalRuntime,
  type Episode,
  type Season,
} from '@/entities/episode';
import { ReminderToggle } from '@/features/media-reminder';
import { WantToWatchButton } from '@/features/save-to-library';
import { formatCount, interpolate, useTranslation } from '@/shared/i18n';
import { preloadWhenIdle } from '@/shared/lib';
import { NoticeBar, useEpisodesTracker, type EpisodesTracker } from '@/widgets/episodes-sheet';
import { useEpisodesDialog } from '../model/use-episodes-dialog';
import { useRememberTracking } from '../model/use-remember-tracking';
import { useRateMedia } from '../model/use-rate-media';
import type { ActionMedia } from '../model/action-media';
import { RatingTrigger, type TriggerLook } from './rating-trigger';
import { DesktopMoreMenu } from './more-menu';
import { TrackingCard } from './tracking-card';
import { RatingDialog } from './rating-dialog';
import { ShowActionsSkeleton } from './show-actions-skeleton';

const EPISODE_SLOT = 'flex min-h-[4.125rem] items-center gap-3';

const loadEpisodesSheet = () =>
  import('@/widgets/episodes-sheet/index.client').then((module) => module.EpisodesSheet);

const EpisodesSheet = dynamic(loadEpisodesSheet, { ssr: false });

const PAGE_NOTICE =
  'fixed inset-x-3 bottom-[calc(var(--tab-bar-height)+var(--safe-bottom)+0.75rem)] z-30 md:inset-x-auto md:end-6 md:bottom-6 md:w-[26rem]';

function RateAction({ media, look }: { media: ActionMedia; look: TriggerLook }) {
  const rating = useRateMedia(media);

  if (rating.isResolving) {
    const size = look === 'compactScore' ? 'h-12 w-28' : 'h-13 w-full md:w-32';
    return <Skeleton className={`shrink-0 rounded-full ${size}`} />;
  }
  return (
    <RatingDialog
      type={media.type}
      title={media.title}
      rating={rating}
      trigger={<RatingTrigger rating={rating} look={look} />}
    />
  );
}

function useShowFacts(media: ActionMedia, seasons: readonly Season[] | undefined) {
  const { dict, locale } = useTranslation();
  const runtime = seasons ? typicalRuntime(seasons) : undefined;
  return [
    media.seasonCount && formatCount(media.seasonCount, dict.details.seasons, locale),
    media.episodeCount && formatCount(media.episodeCount, dict.details.episodes, locale),
    runtime && interpolate(dict.episodes.perEpisode, { minutes: runtime }),
  ].filter(Boolean);
}

function StartCard({ media, onWatchedUntil }: { media: ActionMedia; onWatchedUntil?: () => void }) {
  const { dict } = useTranslation();
  const facts = useShowFacts(media, media.seasons);

  return (
    <TrackingCard>
      {(headingId) => (
        <>
          <div>
            <h2 id={headingId} className="text-[17px] font-extrabold">
              {dict.details.start.title}
            </h2>
            {facts.length > 0 ? (
              <p className="mt-1 text-sm text-muted tabular-nums">{facts.join(' · ')}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <WantToWatchButton media={media} className="w-full md:w-auto md:flex-1" />
            <div className="flex gap-2.5">
              {onWatchedUntil ? (
                <Button
                  variant="secondary"
                  onPress={onWatchedUntil}
                  className="h-12 min-w-0 flex-1 gap-2 rounded-full px-4 text-[15px] font-semibold text-foreground md:flex-none"
                >
                  <Flag aria-hidden className="size-4.5 shrink-0" />
                  <span className="truncate">{dict.episodes.watchedUntil}</span>
                </Button>
              ) : null}
              <RateAction media={media} look="compactScore" />
            </div>
            <DesktopMoreMenu media={media} />
          </div>
        </>
      )}
    </TrackingCard>
  );
}

function NextEpisode({
  episode,
  tracker,
  onOpen,
}: {
  episode: Episode;
  tracker: EpisodesTracker;
  onOpen: () => void;
}) {
  const { dict, locale } = useTranslation();
  const title = episodeTitle(episode, dict);

  return (
    <div className={EPISODE_SLOT}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-start outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <EpisodeStill episode={episode} badge={episodeCode(episode, dict)} size="card" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] text-muted">{dict.episodes.next}</span>
          <span className="truncate text-[15px] font-bold">{title}</span>
          <span className="truncate text-[13px] text-muted tabular-nums">
            {episodeMeta(episode, true, dict, locale)}
          </span>
        </span>
      </button>
      <Button
        isIconOnly
        variant="primary"
        aria-label={interpolate(dict.episodes.markNext, { title })}
        onPress={() => tracker.toggle(episode, true)}
        className="size-13 shrink-0 rounded-full"
      >
        <Check aria-hidden className="size-6" strokeWidth={2.8} />
      </Button>
    </div>
  );
}

function CaughtUp({ upcoming }: { upcoming?: Episode }) {
  const { dict } = useTranslation();

  return (
    <div className={EPISODE_SLOT}>
      <span
        aria-hidden
        className="flex size-13 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
      >
        <Check className="size-6" strokeWidth={2.8} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{dict.episodes.caughtUp}</span>
        {upcoming ? (
          <span className="text-[13px] text-muted">
            {interpolate(dict.episodes.remindNext, { code: episodeCode(upcoming, dict) })}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function WatchingCard({
  media,
  seasons,
  tracker,
  onOpen,
}: {
  media: ActionMedia;
  seasons: Season[];
  tracker: EpisodesTracker;
  onOpen: () => void;
}) {
  const { dict, locale } = useTranslation();
  const season = currentSeason(seasons, tracker.summary, tracker.watched, tracker.now);
  const { watched, aired } = seasonProgress(season, tracker.watched, tracker.now);
  const upcoming = nextUpcoming(seasons, tracker.now);
  const upcomingDate = upcoming?.airDate ? formatAirDate(locale, upcoming.airDate) : undefined;

  return (
    <TrackingCard>
      {(headingId) => (
        <>
          <div className="flex items-center gap-2.5">
            <h2 id={headingId} className="min-w-0 flex-1 truncate text-[17px] font-extrabold">
              {seasonName(season, dict)}
            </h2>
            <span className="text-sm font-semibold text-muted tabular-nums">
              {watched}/{aired}
            </span>
            <Button
              variant="ghost"
              aria-haspopup="dialog"
              onPress={onOpen}
              className="-me-2 min-h-tap gap-0.5 px-2 text-[15px] font-semibold text-accent"
            >
              {dict.episodes.allEpisodes}
              <ChevronRight aria-hidden className="size-4.5" />
            </Button>
          </div>
          <Meter
            aria-label={interpolate(dict.episodes.seasonProgressLabel, { number: season.number })}
            value={watched}
            maxValue={Math.max(aired, 1)}
            size="sm"
          >
            <Meter.Track>
              <Meter.Fill />
            </Meter.Track>
          </Meter>
          {tracker.summary.next ? (
            <NextEpisode episode={tracker.summary.next} tracker={tracker} onOpen={onOpen} />
          ) : (
            <CaughtUp upcoming={upcoming} />
          )}
          {upcoming && upcomingDate ? (
            <div className="flex items-center gap-2 border-t border-separator pt-1.5 text-[13px] text-muted">
              <CalendarClock aria-hidden className="size-4 shrink-0" />
              <p className="min-w-0 flex-1">
                {interpolate(dict.episodes.airs, {
                  code: episodeCode(upcoming, dict),
                  date: upcomingDate,
                })}
              </p>
              <ReminderToggle
                media={{ mediaItemId: media.mediaItemId, title: media.title }}
                look="text"
                className="-me-2"
              />
            </div>
          ) : null}
        </>
      )}
    </TrackingCard>
  );
}

interface TrackedShow {
  media: ActionMedia;
  showId: string;
  seasons: Season[];
}

function EpisodeTracking({ media, showId, seasons }: TrackedShow) {
  const show = {
    showId,
    mediaItemId: media.mediaItemId,
    slug: media.slug,
    seasons,
    title: media.title,
  };
  const tracker = useEpisodesTracker(show);
  useRememberTracking(media.slug, seasons, tracker);
  const { dialog, open, setOpen, setPicking } = useEpisodesDialog({
    seasons,
    canTrack: tracker.canTrack,
    isResolving: tracker.isResolving,
  });

  useEffect(() => preloadWhenIdle(loadEpisodesSheet), []);

  if (tracker.isResolving) {
    return <ShowActionsSkeleton state={signedInTrackingState(media.trackingState)} />;
  }
  if (!tracker.canTrack) return <StartCard media={media} />;

  return (
    <>
      {tracker.summary.watched > 0 ? (
        <div className="flex flex-col gap-2.5">
          <WatchingCard
            media={media}
            seasons={seasons}
            tracker={tracker}
            onOpen={() => open(false)}
          />
          <div className="flex items-center gap-2.5 *:flex-1 md:*:flex-none">
            <RateAction media={media} look="myScore" />
            <DesktopMoreMenu media={media} />
          </div>
        </div>
      ) : (
        <StartCard media={media} onWatchedUntil={() => open(true)} />
      )}
      {dialog.hasOpened ? (
        <EpisodesSheet
          show={show}
          tracker={tracker}
          isOpen={dialog.isOpen}
          isPicking={dialog.isPicking}
          initialSeason={dialog.initialSeason}
          onOpenChange={setOpen}
          onPickingChange={setPicking}
        />
      ) : null}
      <NoticeBar tracker={tracker} className={dialog.isOpen ? 'hidden' : PAGE_NOTICE} />
    </>
  );
}

export function ShowTracking({ media }: { media: ActionMedia }) {
  if (!media.showId || !media.seasons?.length) return <StartCard media={media} />;
  return (
    <EpisodeTracking
      key={media.showId}
      media={media}
      showId={media.showId}
      seasons={media.seasons}
    />
  );
}

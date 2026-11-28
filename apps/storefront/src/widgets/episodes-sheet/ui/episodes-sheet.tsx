'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@ratingo/web-core/lib';
import {
  EpisodeRow,
  currentSeason,
  episodeKey,
  hasAired,
  seasonProgress,
  unwatchedThrough,
  usePrefetchEpisodeOverview,
  type Episode,
  type Season,
} from '@/entities/episode';
import { WIDE_DESKTOP_MEDIA_QUERY } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useMediaQuery } from '@/shared/lib';
import { ResponsiveDialog } from '@/shared/ui';
import { useSeasonNavigation, type SlideDirection } from '../model/season-navigation';
import type { EpisodesShow, EpisodesTracker } from '../model/use-episodes-tracker';
import { isSeasonComplete } from '../model/season-status';
import { useOpenedEpisode, type OpenedEpisode } from '../model/use-opened-episode';
import { useRowHint } from '../model/use-row-hint';
import { EpisodeDetail } from './episode-detail';
import { EpisodeMenu, type EpisodeMenuTarget } from './episode-menu';
import { PickBanner } from './pick-banner';
import { RowHint } from './row-hint';
import { SeasonSummary } from './season-summary';
import { SheetFooter } from './sheet-footer';
import { SheetHeading, type MenuAction } from './sheet-heading';
import { SeasonTiles } from './season-tiles';

export interface EpisodesSheetProps {
  show: EpisodesShow & { title: string; slug: string };
  tracker: EpisodesTracker;
  isOpen: boolean;
  isPicking: boolean;
  initialSeason?: number;
  onOpenChange: (isOpen: boolean) => void;
  onPickingChange: (isPicking: boolean) => void;
  onNotStarted?: () => void;
}

const REVEAL_GAP_PX = 16;

function scrollParent(element: HTMLElement): HTMLElement | undefined {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
  }
  return undefined;
}

function revealInScroller(element: HTMLElement): void {
  const scroller = scrollParent(element);
  if (!scroller) return;
  const offset = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  if (offset >= 0) return;
  scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + offset - REVEAL_GAP_PX) });
}

const SLIDE_IN: Record<SlideDirection, string> = {
  forward: 'motion-safe:animate-season-forward',
  back: 'motion-safe:animate-season-back',
};

type SheetBodyProps = Pick<
  EpisodesSheetProps,
  'show' | 'tracker' | 'isPicking' | 'initialSeason' | 'onPickingChange' | 'onNotStarted'
> & { opened: OpenedEpisode; canSplit: boolean; onClose: () => void };

function SheetBody({
  show,
  tracker,
  isPicking,
  initialSeason,
  onPickingChange,
  onNotStarted,
  opened,
  canSplit,
  onClose,
}: SheetBodyProps) {
  const { dict } = useTranslation();
  const [pickTarget, setPickTarget] = useState<Episode>();
  const [menuTarget, setMenuTarget] = useState<EpisodeMenuTarget>();
  const rowHint = useRowHint();
  const { watched, now } = tracker;
  const isComplete = useCallback(
    (candidate: Season) => isSeasonComplete(candidate, watched, now),
    [watched, now],
  );
  const navigation = useSeasonNavigation({
    seasons: show.seasons,
    initial: () =>
      initialSeason ?? currentSeason(show.seasons, tracker.summary, watched, now).number,
    now,
    isComplete,
  });
  const latestTracker = useRef(tracker);
  useLayoutEffect(() => {
    latestTracker.current = tracker;
  });
  const toggleEpisode = useCallback(
    (episode: Episode, isWatched: boolean) => latestTracker.current.toggle(episode, isWatched),
    [],
  );
  const showMenu = useCallback(
    (episode: Episode, anchor: Element) => setMenuTarget({ episode, anchor }),
    [],
  );
  const { season, direction } = navigation;
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (direction && topRef.current) revealInScroller(topRef.current);
  }, [season.number, direction]);

  const prefetchOverview = usePrefetchEpisodeOverview(show.slug);
  const { episode: openedEpisode, listRef: episodeListRef, open, close } = opened;
  const openedKey = openedEpisode ? episodeKey(openedEpisode) : undefined;
  const listSeason = useRef({ number: season.number, select: navigation.select, canSplit });
  useLayoutEffect(() => {
    listSeason.current = { number: season.number, select: navigation.select, canSplit };
  });
  const openEpisode = useCallback(
    (episode: Episode) => {
      const current = listSeason.current;
      if (current.canSplit && episode.seasonNumber !== current.number) {
        current.select(episode.seasonNumber);
      }
      open(episode);
    },
    [open],
  );
  const backToSeason = () => {
    if (openedEpisode && openedEpisode.seasonNumber !== season.number) {
      navigation.select(openedEpisode.seasonNumber);
    }
    close();
  };

  const picked = new Set(
    isPicking && pickTarget
      ? unwatchedThrough(show.seasons, pickTarget, tracker.watched, tracker.now)
      : [],
  );

  const togglePickTarget = useCallback(
    (episode: Episode) =>
      setPickTarget((current) => (current?.id === episode.id ? undefined : episode)),
    [],
  );

  const setPicking = (next: boolean) => {
    setPickTarget(undefined);
    onPickingChange(next);
  };

  const runMenuAction = (action: MenuAction) => {
    if (action === 'pick') setPicking(true);
    if (action === 'catchUp') tracker.catchUp();
    if (action === 'reset') tracker.resetSeason(season);
    if (action === 'resetAll') tracker.resetAll();
  };

  const seasonWatched = seasonProgress(season, tracker.watched, tracker.now).watched;
  const disabledActions = [
    ...(tracker.summary.watched >= tracker.summary.aired ? ['catchUp' as const] : []),
    ...(seasonWatched === 0 ? ['reset' as const] : []),
    ...(tracker.watched.size === 0 ? ['resetAll' as const] : []),
  ];

  const confirmPick = () => {
    if (pickTarget) tracker.markThrough(pickTarget);
    setPicking(false);
  };

  const detail = openedEpisode ? (
    <EpisodeDetail
      layout={canSplit ? 'pane' : 'page'}
      showSlug={show.slug}
      seasons={show.seasons}
      episode={openedEpisode}
      tracker={tracker}
      onOpen={openEpisode}
      onBack={backToSeason}
      onClose={onClose}
    />
  ) : null;

  if (detail && !isPicking && !canSplit) return detail;

  const list = (
    <div className="min-w-0">
      {isPicking ? (
        <PickBanner onCancel={onNotStarted ? onClose : () => setPicking(false)} />
      ) : null}
      <div className="flex flex-col gap-3">
        <SheetHeading
          title={show.title}
          tracker={tracker}
          disabledActions={disabledActions}
          onMenuAction={runMenuAction}
          onClose={onClose}
        />
        <div ref={topRef}>
          <SeasonTiles
            seasons={show.seasons}
            selected={season.number}
            onSelect={navigation.select}
            tracker={tracker}
          />
        </div>
        <div className="-mx-4 overflow-x-clip px-4">
          <div
            key={season.number}
            className={cn('flex flex-col gap-3', direction && SLIDE_IN[direction])}
          >
            <SeasonSummary
              season={season}
              tracker={tracker}
              onMarkSeason={() => tracker.markSeason(season)}
            />
            <ul
              ref={episodeListRef}
              aria-label={interpolate(dict.episodes.season, { number: season.number })}
              className="flex flex-col gap-1.5 pb-[calc(6rem+var(--safe-bottom))]"
            >
              {season.episodes.map((episode) => (
                <EpisodeRow
                  key={episode.id ?? episode.number}
                  episode={episode}
                  isAired={hasAired(episode, tracker.now)}
                  isNext={
                    !isPicking &&
                    episode.id !== undefined &&
                    episode.id === tracker.summary.next?.id
                  }
                  isWatched={episode.id !== undefined && tracker.watched.has(episode.id)}
                  isPicked={episode.id !== undefined && picked.has(episode.id)}
                  isOpened={canSplit && openedKey === episodeKey(episode)}
                  onWatchedChange={toggleEpisode}
                  onPick={isPicking ? togglePickTarget : undefined}
                  onOpen={openEpisode}
                  onOpenIntent={prefetchOverview}
                  onMenu={showMenu}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
      <EpisodeMenu
        target={menuTarget}
        tracker={tracker}
        onOpen={openEpisode}
        onClose={() => setMenuTarget(undefined)}
      />
      <div className="sticky bottom-0 z-20 h-0">
        <div className="absolute inset-x-0 bottom-[calc(var(--safe-bottom)+0.75rem)]">
          {rowHint.isVisible && !isPicking && !tracker.notice ? (
            <RowHint onDismiss={rowHint.dismiss} />
          ) : null}
          <SheetFooter
            show={show}
            season={season}
            tracker={tracker}
            isPicking={isPicking}
            pickTarget={pickTarget}
            onStartPicking={() => setPicking(true)}
            onConfirmPick={confirmPick}
            onNotStarted={onNotStarted}
          />
        </div>
      </div>
    </div>
  );

  if (!detail || isPicking) return list;

  return (
    <div className="grid grid-cols-[minmax(0,30rem)_minmax(0,1fr)] gap-6">
      <div className="sticky top-0 max-h-[calc(100dvh-3rem)] self-start overflow-y-auto">
        {detail}
      </div>
      {list}
    </div>
  );
}

export function EpisodesSheet({
  show,
  tracker,
  isOpen,
  isPicking,
  initialSeason,
  onOpenChange,
  onPickingChange,
  onNotStarted,
}: EpisodesSheetProps) {
  const { dict } = useTranslation();
  const opened = useOpenedEpisode();
  const isWideScreen = useMediaQuery(WIDE_DESKTOP_MEDIA_QUERY);
  const isSplit = isWideScreen && opened.episode !== undefined && !isPicking;
  const changeOpen = (next: boolean) => {
    if (!next) opened.close();
    onOpenChange(next);
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={changeOpen}
      title={dict.episodes.title}
      isHeaderless
      isWide={isSplit}
      size="full"
      desktop="side"
    >
      <SheetBody
        show={show}
        tracker={tracker}
        isPicking={isPicking}
        initialSeason={initialSeason}
        onPickingChange={onPickingChange}
        onNotStarted={onNotStarted}
        opened={opened}
        canSplit={isWideScreen}
        onClose={() => changeOpen(false)}
      />
    </ResponsiveDialog>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@heroui/react';
import {
  countEpisodes,
  episodeCode,
  episodeShortCode,
  summarizeProgress,
  unwatchedAired,
  unwatchedThrough,
  useSetEpisodesWatched,
  useShowProgress,
  watchedIn,
  type Episode,
  type Season,
  type ShowProgressSummary,
  type WatchChange,
} from '@/entities/episode';
import { useMediaStateStore } from '@/entities/library';
import { interpolate, useTranslation } from '@/shared/i18n';
import { track, useClientNow } from '@/shared/lib';

const NOTICE_VISIBLE_MS = 8000;

type TrackedAction =
  | 'toggle'
  | 'mark_only'
  | 'mark_season'
  | 'reset_season'
  | 'reset_all'
  | 'catch_up'
  | 'mark_through';

export interface EpisodesShow {
  showId: string;
  mediaItemId: string;
  seasons: Season[];
}

interface NoticeAction {
  label: string;
  change: WatchChange;
}

interface EpisodeNotice {
  id: number;
  message: string;
  undo: WatchChange;
  narrow?: NoticeAction;
}

export interface EpisodesTracker {
  now: number;
  watched: ReadonlySet<string>;
  summary: ShowProgressSummary;
  canTrack: boolean;
  isResolving: boolean;
  notice?: EpisodeNotice;
  holdNotice: (isHeld: boolean) => void;
  undoNotice: () => void;
  narrowNotice: () => void;
  toggle: (episode: Episode, isWatched: boolean) => void;
  markOnly: (episode: Episode) => void;
  rangeThrough: (episode: Episode) => Episode[];
  markSeason: (season: Season) => void;
  resetSeason: (season: Season) => void;
  resetAll: () => void;
  catchUp: () => void;
  markThrough: (episode: Episode) => void;
}

function opposite(change: WatchChange): WatchChange {
  return { episodeIds: change.episodeIds, watched: !change.watched };
}

function episodeById(seasons: readonly Season[], id: string): Episode | undefined {
  return seasons.flatMap((season) => season.episodes).find((episode) => episode.id === id);
}

function seasonsOfEpisode(seasons: readonly Season[], episode: Episode): Season[] {
  return seasons.filter((season) => season.number === episode.seasonNumber);
}

function useNotice() {
  const [current, setCurrent] = useState<EpisodeNotice>();
  const [isHeld, setHeld] = useState(false);
  const nextId = useRef(0);

  useEffect(() => {
    if (!current || isHeld) return;
    const timer = setTimeout(() => setCurrent(undefined), NOTICE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [current, isHeld]);

  const show = (message: string, undo: WatchChange, narrow?: NoticeAction) => {
    nextId.current += 1;
    setHeld(false);
    setCurrent({ id: nextId.current, message, undo, narrow });
  };

  const clear = () => {
    setHeld(false);
    setCurrent(undefined);
  };

  return { current, show, hold: setHeld, clear };
}

export function useEpisodesTracker({
  showId,
  mediaItemId,
  seasons,
}: EpisodesShow): EpisodesTracker {
  const { dict, locale } = useTranslation();
  const labels = dict.episodes.notice;
  const now = useClientNow();
  const mediaStateStore = useMediaStateStore();
  const { watched, canTrack, isResolving } = useShowProgress(showId);
  const notice = useNotice();
  const setWatched = useSetEpisodesWatched({
    showId,
    seasons,
    onSynced: () => mediaStateStore.refresh(mediaItemId),
    onFailed: () => {
      notice.clear();
      toast.danger(labels.failed);
    },
  });
  const summary = useMemo(() => summarizeProgress(seasons, watched, now), [seasons, watched, now]);

  const apply = (
    action: TrackedAction,
    change: WatchChange,
    message: string,
    narrow?: NoticeAction,
  ) => {
    if (change.episodeIds.length === 0) return;
    setWatched(change, () => track('episode_mark', { action, origin: 'sheet' }));
    notice.show(message, opposite(change), narrow);
  };

  const markRange = (episode: Episode, episodeIds: string[]) => {
    const first = episodeById(seasons, episodeIds[0]) ?? episode;
    const others = episodeIds.filter((id) => id !== episode.id);
    apply(
      'toggle',
      { episodeIds, watched: true },
      interpolate(labels.range, {
        from: episodeShortCode(first, dict),
        to: episodeShortCode(episode, dict),
      }),
      {
        label: interpolate(labels.onlyThis, { episode: episodeShortCode(episode, dict) }),
        change: { episodeIds: others, watched: false },
      },
    );
  };

  const unwatchedIdsThrough = (episode: Episode) =>
    unwatchedThrough(seasonsOfEpisode(seasons, episode), episode, watched, now);

  const rangeThrough = (episode: Episode): Episode[] =>
    unwatchedIdsThrough(episode).flatMap((id) => episodeById(seasons, id) ?? []);

  const toggle = (episode: Episode, isWatched: boolean) => {
    if (episode.id === undefined) return;
    const code = episodeCode(episode, dict);
    if (!isWatched) {
      apply(
        'toggle',
        { episodeIds: [episode.id], watched: false },
        interpolate(labels.unwatched, { code }),
      );
      return;
    }
    const episodeIds = unwatchedIdsThrough(episode);
    if (episodeIds.length > 1) {
      markRange(episode, episodeIds);
      return;
    }
    apply(
      'toggle',
      { episodeIds: [episode.id], watched: true },
      interpolate(labels.watched, { code }),
    );
  };

  const markOnly = (episode: Episode) => {
    if (episode.id === undefined) return;
    apply(
      'mark_only',
      { episodeIds: [episode.id], watched: true },
      interpolate(labels.watched, { code: episodeCode(episode, dict) }),
    );
  };

  const markSeason = (season: Season) =>
    apply(
      'mark_season',
      { episodeIds: unwatchedAired([season], watched, now), watched: true },
      interpolate(labels.seasonWatched, { number: season.number }),
    );

  const resetSeason = (season: Season) =>
    apply(
      'reset_season',
      { episodeIds: watchedIn(season, watched), watched: false },
      interpolate(labels.seasonReset, { number: season.number }),
    );

  const resetAll = () =>
    apply(
      'reset_all',
      { episodeIds: seasons.flatMap((season) => watchedIn(season, watched)), watched: false },
      labels.allReset,
    );

  const catchUp = () => {
    const episodeIds = unwatchedAired(seasons, watched, now);
    apply(
      'catch_up',
      { episodeIds, watched: true },
      interpolate(labels.caughtUp, { episodes: countEpisodes(episodeIds.length, dict, locale) }),
    );
  };

  const markThrough = (episode: Episode) =>
    apply(
      'mark_through',
      { episodeIds: unwatchedThrough(seasons, episode, watched, now), watched: true },
      interpolate(labels.pickedUntil, { code: episodeCode(episode, dict) }),
    );

  const runNoticeAction = (change: WatchChange | undefined) => {
    if (change) setWatched(change);
    notice.clear();
  };

  return {
    now,
    watched,
    summary,
    canTrack,
    isResolving,
    notice: notice.current,
    holdNotice: notice.hold,
    undoNotice: () => runNoticeAction(notice.current?.undo),
    narrowNotice: () => runNoticeAction(notice.current?.narrow?.change),
    toggle,
    markOnly,
    rangeThrough,
    markSeason,
    resetSeason,
    resetAll,
    catchUp,
    markThrough,
  };
}

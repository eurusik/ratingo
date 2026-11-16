'use client';

import { useRef, useState } from 'react';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { toSeasons, type Season } from '@/entities/episode';
import { useMediaStateStore } from '@/entities/library';
import { catalogApi, libraryApi, type WatchState } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import type { RatedShow } from './rated-shows';

export type WatchMark =
  { kind: 'stoppedAt'; code: string } | { kind: 'notStarted' } | { kind: 'caughtUp' };

export interface ShowEpisodes {
  showId: string;
  seasons: Season[];
}

const SHOW_STALE_MS = 10 * 60 * 1000;

export function showEpisodesQuery(slug: string) {
  return queryOptions({
    queryKey: ['catalog', 'show-episodes', slug] as const,
    staleTime: SHOW_STALE_MS,
    queryFn: async (): Promise<ShowEpisodes> => {
      const show = await catalogApi.getShowBySlug(slug);
      return { showId: show.showId, seasons: toSeasons(show.seasons) };
    },
  });
}

export function useShowEpisodes(slug: string) {
  return useQuery(showEpisodesQuery(slug));
}

export function useImportedShowWatching() {
  const { dict } = useTranslation();
  const mediaStates = useMediaStateStore();
  const [marks, setMarks] = useState<Readonly<Record<string, WatchMark>>>({});
  const [openShow, setOpenShow] = useState<RatedShow>();
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());

  const setBusy = (mediaItemId: string, isBusy: boolean) => {
    if (isBusy) inFlight.current.add(mediaItemId);
    else inFlight.current.delete(mediaItemId);
    setBusyIds(new Set(inFlight.current));
  };

  const moveTo = async (mediaItemId: string, state: WatchState) => {
    if (inFlight.current.has(mediaItemId)) return false;
    setBusy(mediaItemId, true);
    try {
      mediaStates.write(mediaItemId, await libraryApi.setState(mediaItemId, state, 'show'));
      return true;
    } catch (error) {
      console.error('Moving an imported show failed', { mediaItemId, state, error });
      toast.danger(dict.settings.import.shows.failed);
      return false;
    } finally {
      setBusy(mediaItemId, false);
    }
  };

  const remember = (show: RatedShow, mark: WatchMark) =>
    setMarks((current) => ({ ...current, [show.mediaItemId]: mark }));

  const markWatching = async (show: RatedShow, mark: WatchMark) => {
    setOpenShow(undefined);
    if (mark.kind === 'caughtUp') {
      remember(show, mark);
      return;
    }
    if (await moveTo(show.mediaItemId, 'watching')) remember(show, mark);
  };

  const unmark = async (show: RatedShow) => {
    if (!(await moveTo(show.mediaItemId, 'completed'))) return;
    setMarks((current) => {
      const { [show.mediaItemId]: _removed, ...rest } = current;
      return rest;
    });
  };

  return {
    marks,
    openShow,
    isBusy: (mediaItemId: string) =>
      busyIds.has(mediaItemId) || openShow?.mediaItemId === mediaItemId,
    open: setOpenShow,
    close: () => setOpenShow(undefined),
    markWatching,
    unmark,
  };
}

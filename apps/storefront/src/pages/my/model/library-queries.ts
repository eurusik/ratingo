'use client';

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { LIBRARY_LISTS_KEY } from '@/entities/library';
import {
  calendarApi,
  fetchAllPages,
  libraryApi,
  type LibraryPageQuery,
  type MediaType,
  type SavedItem,
  type UserMediaState,
} from '@/shared/api';
import { SERVICE_TIME_ZONE } from '@/shared/config';
import { mergeSaved } from './plan-order';
import { toHistoryRows, type HistoryRow } from './history-months';

const PAGE_SIZE = 100;
const LIST_STALE_MS = 60 * 1000;
const RECENT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type Page<T> = { data: T[]; meta: { hasMore?: boolean } };

function fetchAll<T>(load: (query: LibraryPageQuery) => Promise<Page<T>>): Promise<T[]> {
  return fetchAllPages(PAGE_SIZE, load);
}

function libraryListKey(viewerId: string | null, list: string) {
  return [...LIBRARY_LISTS_KEY, viewerId, list] as const;
}

function useLibraryQuery<T>(list: string, load: () => Promise<T>) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: libraryListKey(user?.id ?? null, list),
    queryFn: load,
    enabled: isAuthenticated,
    staleTime: LIST_STALE_MS,
  });
}

const serviceDateKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: SERVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateKey(at: number): string {
  return serviceDateKey.format(at);
}

function loadRecentEpisodes() {
  return calendarApi.getRange({
    startDate: dateKey(Date.now() - (RECENT_DAYS - 1) * DAY_MS),
    days: RECENT_DAYS,
    personalized: true,
  });
}

const loadWatching = () =>
  fetchAll<UserMediaState>((query) =>
    libraryApi.getHistory({ ...query, state: 'watching', type: 'show' }),
  );

const loadCaughtUp = () =>
  fetchAll<UserMediaState>((query) => libraryApi.getCaughtUp({ ...query, type: 'show' }));

const loadPaused = () => fetchAll<UserMediaState>((query) => libraryApi.getPaused(query));

const loadDropped = () => fetchAll<UserMediaState>((query) => libraryApi.getDropped(query));

async function loadPlan() {
  const [forLater, considering] = await Promise.all([
    fetchAll<SavedItem>((query) => libraryApi.getSaved('for_later', query)),
    fetchAll<SavedItem>((query) => libraryApi.getSaved('considering', query)),
  ]);
  return mergeSaved(forLater, considering);
}

async function loadHistory() {
  const items = await fetchAll<UserMediaState>((query) =>
    libraryApi.getHistory({ ...query, state: 'completed' }),
  );
  return toHistoryRows(items);
}

export function useWatchingLists() {
  const watching = useLibraryQuery('watching', loadWatching);
  const caughtUp = useLibraryQuery('caught-up', loadCaughtUp);
  const recent = useLibraryQuery('recent-episodes', loadRecentEpisodes);
  return { watching, caughtUp, recent };
}

export function useShelfLists() {
  const paused = useLibraryQuery('paused', loadPaused);
  const dropped = useLibraryQuery('dropped', loadDropped);
  return { paused, dropped };
}

export function usePlanList() {
  return useLibraryQuery('plan', loadPlan);
}

const HISTORY_PAGE_SIZE = 20;

interface HistoryPage {
  rows: HistoryRow[];
  hasMore: boolean;
}

export function useHistoryPages(type: MediaType | undefined) {
  const { user, isAuthenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: [...libraryListKey(user?.id ?? null, 'history'), 'pages', type ?? 'all'],
    queryFn: async ({ pageParam }): Promise<HistoryPage> => {
      const page = await libraryApi.getHistory({
        limit: HISTORY_PAGE_SIZE,
        offset: pageParam,
        state: 'completed',
        type,
      });
      return { rows: toHistoryRows(page.data), hasMore: page.meta.hasMore ?? false };
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length * HISTORY_PAGE_SIZE : undefined,
    placeholderData: keepPreviousData,
    enabled: isAuthenticated,
    staleTime: LIST_STALE_MS,
  });
}

export function useHistorySearch(isSearching: boolean) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...libraryListKey(user?.id ?? null, 'history'), 'all'],
    queryFn: loadHistory,
    enabled: isAuthenticated && isSearching,
    staleTime: LIST_STALE_MS,
  });
}

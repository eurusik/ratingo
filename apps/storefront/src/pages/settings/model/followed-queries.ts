'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { SUBSCRIPTIONS_KEY, followedTitlesKey } from '@/entities/subscription';
import { fetchAllPages, subscriptionsApi } from '@/shared/api';
import { pluralize } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { showUndoToast } from '@/shared/lib';
import { groupFollowedTitles, type FollowedTitle } from './followed-titles';

const PAGE_SIZE = 100;
const FOLLOWED_STALE_MS = 60 * 1000;
const SUBSCRIPTION_CONTEXT = 'settings';

async function fetchFollowedTitles(): Promise<FollowedTitle[]> {
  return groupFollowedTitles(await fetchAllPages(PAGE_SIZE, subscriptionsApi.list));
}

export function useFollowedTitles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: followedTitlesKey(user?.id ?? null),
    queryFn: fetchFollowedTitles,
    enabled: user !== null,
    staleTime: FOLLOWED_STALE_MS,
  });
}

export function useFollowedSummary(): string | undefined {
  const { dict, locale } = useTranslation();
  const { data } = useFollowedTitles();
  if (!data?.length) return undefined;
  return interpolate(pluralize(data.length, dict.my.titleCount, locale), { count: data.length });
}

interface PlacedTitle {
  title: FollowedTitle;
  index: number;
}

function withTitle(titles: FollowedTitle[], { title, index }: PlacedTitle): FollowedTitle[] {
  const rest = titles.filter((known) => known.mediaItemId !== title.mediaItemId);
  return [...rest.slice(0, index), title, ...rest.slice(index)];
}

function withoutTitle(titles: FollowedTitle[], mediaItemId: string): FollowedTitle[] {
  return titles.filter((title) => title.mediaItemId !== mediaItemId);
}

const FOLLOWING_MUTATION_KEY = [...SUBSCRIPTIONS_KEY, 'following'] as const;

function useFollowedCache() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = followedTitlesKey(user?.id ?? null);
  return {
    queryKey,
    cancel: () => queryClient.cancelQueries({ queryKey }),
    settle: () => {
      const isLastChange = queryClient.isMutating({ mutationKey: FOLLOWING_MUTATION_KEY }) <= 1;
      if (isLastChange) void queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
    },
    update: (change: (titles: FollowedTitle[]) => FollowedTitle[]) =>
      queryClient.setQueryData<FollowedTitle[]>(queryKey, (titles) => titles && change(titles)),
  };
}

async function followAgain({ mediaItemId, triggers }: FollowedTitle): Promise<void> {
  await Promise.all(
    triggers.map((trigger) =>
      subscriptionsApi.subscribe(mediaItemId, trigger, SUBSCRIPTION_CONTEXT),
    ),
  );
}

async function stopFollowing({ mediaItemId, triggers }: FollowedTitle): Promise<void> {
  await Promise.all(
    triggers.map((trigger) =>
      subscriptionsApi.unsubscribe(mediaItemId, trigger, SUBSCRIPTION_CONTEXT),
    ),
  );
}

export function useUnfollowTitle(): (placed: PlacedTitle) => void {
  const { dict } = useTranslation();
  const copy = dict.settings.notifications;
  const cache = useFollowedCache();

  const fail = (error: Error, placed: PlacedTitle) => {
    console.error('Changing a followed title failed', { title: placed.title.mediaItemId, error });
    toast.danger(copy.unfollowFailed);
  };

  const follow = useMutation({
    mutationKey: FOLLOWING_MUTATION_KEY,
    mutationFn: (placed: PlacedTitle) => followAgain(placed.title),
    onMutate: async (placed) => {
      await cache.cancel();
      cache.update((titles) => withTitle(titles, placed));
    },
    onError: (error, placed) => {
      cache.update((titles) => withoutTitle(titles, placed.title.mediaItemId));
      fail(error, placed);
    },
    onSettled: cache.settle,
  });

  const unfollow = useMutation({
    mutationKey: FOLLOWING_MUTATION_KEY,
    mutationFn: (placed: PlacedTitle) => stopFollowing(placed.title),
    onMutate: async (placed) => {
      await cache.cancel();
      cache.update((titles) => withoutTitle(titles, placed.title.mediaItemId));
    },
    onSuccess: (_result, placed) =>
      showUndoToast({
        key: `settings-unfollow-${placed.title.mediaItemId}`,
        message: interpolate(copy.unfollowed, { title: placed.title.title }),
        undoLabel: copy.undo,
        onUndo: () => follow.mutate(placed),
      }),
    onError: (error, placed) => {
      cache.update((titles) => withTitle(titles, placed));
      fail(error, placed);
    },
    onSettled: cache.settle,
  });

  return unfollow.mutate;
}

'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { SUBSCRIPTIONS_KEY, remindedShowsKey } from '@/entities/subscription';
import { fetchAllPages, subscriptionsApi } from '@/shared/api';
import { useSignedInAction } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';
import { track } from '@/shared/lib';

const REMINDER_TRIGGER = 'new_episode';
const PAGE_SIZE = 100;
const REMINDERS_STALE_MS = 5 * 60 * 1000;

async function fetchRemindedShows(): Promise<ReadonlySet<string>> {
  const subscriptions = await fetchAllPages(PAGE_SIZE, subscriptionsApi.list);
  return new Set(
    subscriptions
      .filter((subscription) => subscription.trigger === REMINDER_TRIGGER && subscription.isActive)
      .map((subscription) => subscription.mediaItemId),
  );
}

function withShow(shows: ReadonlySet<string>, showId: string, isOn: boolean): ReadonlySet<string> {
  const next = new Set(shows);
  if (isOn) next.add(showId);
  else next.delete(showId);
  return next;
}

export interface ReminderShow {
  mediaItemId: string;
  title: string;
}

export interface EpisodeReminder {
  isOn: boolean;
  toggle: () => void;
}

export function useEpisodeReminder(show: ReminderShow): EpisodeReminder {
  const { dict } = useTranslation();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const runSignedIn = useSignedInAction();
  const queryKey = remindedShowsKey(user?.id ?? null);
  const { data } = useQuery({
    queryKey,
    queryFn: fetchRemindedShows,
    enabled: isAuthenticated,
    staleTime: REMINDERS_STALE_MS,
  });
  const isOn = isAuthenticated && (data?.has(show.mediaItemId) ?? false);

  const { mutate, isPending } = useMutation({
    mutationFn: async (turnOn: boolean) => {
      if (turnOn) await subscriptionsApi.subscribe(show.mediaItemId, REMINDER_TRIGGER);
      else await subscriptionsApi.unsubscribe(show.mediaItemId, REMINDER_TRIGGER);
    },
    onMutate: async (turnOn) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ReadonlySet<string>>(queryKey);
      if (previous)
        queryClient.setQueryData(queryKey, withShow(previous, show.mediaItemId, turnOn));
      return { previous };
    },
    onSuccess: (_result, turnOn) => {
      track('episode_reminder', { enabled: turnOn });
      toast(interpolate(turnOn ? dict.reminder.on : dict.reminder.off, { show: show.title }));
    },
    onError: (error, _turnOn, context) => {
      console.error('Changing an episode reminder failed', { show: show.mediaItemId, error });
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.danger(dict.reminder.failed);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY }),
  });

  const toggle = useCallback(() => {
    if (!isPending) runSignedIn(() => mutate(!isOn));
  }, [isOn, isPending, mutate, runSignedIn]);

  return { isOn, toggle };
}

'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { subscriptionsApi } from '@/shared/api';
import { useSignedInAction } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';

const REMINDER_TRIGGER = 'new_episode';
const PAGE_SIZE = 100;
const REMINDERS_STALE_MS = 5 * 60 * 1000;

function remindersKey(userId: string | null) {
  return ['subscriptions', 'reminders', userId] as const;
}

async function fetchRemindedShows(): Promise<ReadonlySet<string>> {
  const shows = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await subscriptionsApi.list(PAGE_SIZE, offset);
    for (const subscription of page.data) {
      if (subscription.trigger === REMINDER_TRIGGER && subscription.isActive) {
        shows.add(subscription.mediaItemId);
      }
    }
    if (!page.meta.hasMore) return shows;
  }
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
  const queryKey = remindersKey(user?.id ?? null);
  const { data } = useQuery({
    queryKey,
    queryFn: fetchRemindedShows,
    enabled: isAuthenticated,
    staleTime: REMINDERS_STALE_MS,
  });
  const isOn = isAuthenticated && (data?.has(show.mediaItemId) ?? false);

  const { mutate } = useMutation({
    mutationFn: async (turnOn: boolean) => {
      if (turnOn) await subscriptionsApi.subscribe(show.mediaItemId, REMINDER_TRIGGER);
      else await subscriptionsApi.unsubscribe(show.mediaItemId, REMINDER_TRIGGER);
    },
    onMutate: async (turnOn) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<ReadonlySet<string>>(queryKey, (shows) =>
        withShow(shows ?? new Set(), show.mediaItemId, turnOn),
      );
    },
    onSuccess: (_result, turnOn) => {
      toast(interpolate(turnOn ? dict.reminder.on : dict.reminder.off, { show: show.title }));
    },
    onError: (error, turnOn) => {
      console.error('Changing an episode reminder failed', { show: show.mediaItemId, error });
      queryClient.setQueryData<ReadonlySet<string>>(queryKey, (shows) =>
        withShow(shows ?? new Set(), show.mediaItemId, !turnOn),
      );
      toast.danger(dict.reminder.failed);
    },
  });

  const toggle = useCallback(() => runSignedIn(() => mutate(!isOn)), [isOn, mutate, runSignedIn]);

  return { isOn, toggle };
}

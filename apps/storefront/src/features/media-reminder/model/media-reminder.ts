'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { CALENDAR_QUERY_KEY } from '@/entities/episode';
import { SUBSCRIPTIONS_KEY, remindersKey } from '@/entities/subscription';
import { fetchAllPages, subscriptionsApi, type SubscriptionTrigger } from '@/shared/api';
import { useSignedInAction } from '@/shared/auth';
import { interpolate, useTranslation, type Dictionary } from '@/shared/i18n';
import { track } from '@/shared/lib';

export type ReminderTrigger = Extract<SubscriptionTrigger, 'new_episode' | 'release'>;

const PAGE_SIZE = 100;
const REMINDERS_STALE_MS = 5 * 60 * 1000;

const REMINDER_EVENTS = {
  new_episode: 'episode_reminder',
  release: 'release_reminder',
} as const satisfies Record<ReminderTrigger, string>;

type ReminderCopy = Pick<Dictionary['reminder'], 'remind' | 'label' | 'on' | 'off'>;

export function reminderCopy(dict: Dictionary, trigger: ReminderTrigger): ReminderCopy {
  return trigger === 'release' ? dict.reminder.release : dict.reminder;
}

type RemindedMedia = Readonly<Record<ReminderTrigger, ReadonlySet<string>>>;

function isReminderTrigger(trigger: SubscriptionTrigger): trigger is ReminderTrigger {
  return Object.hasOwn(REMINDER_EVENTS, trigger);
}

async function fetchReminded(): Promise<RemindedMedia> {
  const subscriptions = await fetchAllPages(PAGE_SIZE, subscriptionsApi.list);
  const reminded = { new_episode: new Set<string>(), release: new Set<string>() };
  for (const { trigger, isActive, mediaItemId } of subscriptions) {
    if (isActive && isReminderTrigger(trigger)) reminded[trigger].add(mediaItemId);
  }
  return reminded;
}

function withMedia(
  reminded: RemindedMedia,
  trigger: ReminderTrigger,
  { mediaItemId, isOn }: { mediaItemId: string; isOn: boolean },
): RemindedMedia {
  const next = new Set(reminded[trigger]);
  if (isOn) next.add(mediaItemId);
  else next.delete(mediaItemId);
  return { ...reminded, [trigger]: next };
}

export interface ReminderMedia {
  mediaItemId: string;
  title: string;
  isReminderSet?: boolean;
}

export interface MediaReminder {
  isOn: boolean;
  toggle: () => void;
}

export function useMediaReminder(media: ReminderMedia, trigger: ReminderTrigger): MediaReminder {
  const { dict } = useTranslation();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const runSignedIn = useSignedInAction();
  const queryKey = remindersKey(user?.id ?? null);
  const { data } = useQuery({
    queryKey,
    queryFn: fetchReminded,
    enabled: isAuthenticated,
    staleTime: REMINDERS_STALE_MS,
  });
  const knownIsOn = data?.[trigger].has(media.mediaItemId) ?? media.isReminderSet ?? false;
  const isOn = isAuthenticated && knownIsOn;
  const copy = reminderCopy(dict, trigger);

  const { mutate, isPending } = useMutation({
    mutationFn: async (turnOn: boolean) => {
      if (turnOn) await subscriptionsApi.subscribe(media.mediaItemId, trigger);
      else await subscriptionsApi.unsubscribe(media.mediaItemId, trigger);
    },
    onMutate: async (turnOn) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RemindedMedia>(queryKey);
      if (previous) {
        const change = { mediaItemId: media.mediaItemId, isOn: turnOn };
        queryClient.setQueryData(queryKey, withMedia(previous, trigger, change));
      }
      return { previous };
    },
    onSuccess: (_result, turnOn) => {
      track(REMINDER_EVENTS[trigger], { enabled: turnOn });
      toast(interpolate(turnOn ? copy.on : copy.off, { title: media.title }));
    },
    onError: (error, _turnOn, context) => {
      console.error('Changing a reminder failed', { media: media.mediaItemId, trigger, error });
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.danger(dict.reminder.failed);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
      if (trigger === 'release')
        await queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY });
    },
  });

  const toggle = useCallback(() => {
    if (!isPending) runSignedIn(() => mutate(!isOn));
  }, [isOn, isPending, mutate, runSignedIn]);

  return { isOn, toggle };
}

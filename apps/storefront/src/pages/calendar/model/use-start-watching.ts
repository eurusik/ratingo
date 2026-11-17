'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { useMediaStateStore } from '@/entities/library';
import { libraryApi, type CalendarEpisode, type CalendarRange } from '@/shared/api';
import { useSignedInAction } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';
import { track } from '@/shared/lib';
import { withTracked } from './calendar-range';
import { viewerCalendarKey } from './calendar-keys';

export interface StartWatching {
  start: (episode: CalendarEpisode) => void;
  pendingShowId?: string;
}

export function useStartWatching(onStarted: () => void): StartWatching {
  const { dict } = useTranslation();
  const queryClient = useQueryClient();
  const mediaStateStore = useMediaStateStore();
  const runSignedIn = useSignedInAction();
  const viewerId = useAuth().user?.id ?? null;

  const { mutate, isPending, variables } = useMutation({
    mutationFn: (episode: CalendarEpisode) => libraryApi.startWatching(episode.showId),
    onSuccess: (mediaState, episode) => {
      track('library_action', { action: 'start_from_calendar' });
      onStarted();
      mediaStateStore.write(episode.showId, mediaState);
      queryClient.setQueriesData<CalendarRange>(
        { queryKey: viewerCalendarKey(viewerId) },
        (range) => range && withTracked(range, episode.showId),
      );
      toast.success(interpolate(dict.calendar.startedWatching, { show: episode.showTitle }));
      return queryClient.invalidateQueries({ queryKey: viewerCalendarKey(viewerId) });
    },
    onError: (error, episode) => {
      console.error('Starting a show from the calendar failed', { showId: episode.showId, error });
      toast.danger(dict.calendar.startFailed);
    },
  });

  const start = useCallback(
    (episode: CalendarEpisode) => runSignedIn(() => mutate(episode)),
    [runSignedIn, mutate],
  );

  return {
    start,
    pendingShowId: isPending ? variables?.showId : undefined,
  };
}

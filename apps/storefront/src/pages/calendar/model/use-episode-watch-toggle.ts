'use client';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { useSetEpisodesWatched } from '@/entities/episode';
import type { CalendarEpisode, CalendarRange } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { showUndoToast, track } from '@/shared/lib';
import { withWatched } from './calendar-range';
import { calendarEpisodeCode } from './episode-line';
import { viewerCalendarKey } from './calendar-keys';

const WATCH_TOAST_KEY = 'calendar-watch';

function useOptimisticWatched(episode: CalendarEpisode) {
  const { dict } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = viewerCalendarKey(useAuth().user?.id ?? null);

  const setWatched = useSetEpisodesWatched({
    showId: episode.showRecordId,
    onFailed: () => {
      void queryClient.invalidateQueries({ queryKey });
      toast.danger(dict.episodes.notice.failed);
    },
  });

  return async (isWatched: boolean, isTracked = false) => {
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueriesData<CalendarRange>(
      { queryKey },
      (range) => range && withWatched(range, episode.episodeId, isWatched),
    );
    setWatched({ episodeIds: [episode.episodeId], watched: isWatched }, () => {
      if (isTracked) track('episode_mark', { action: 'toggle', origin: 'calendar' });
    });
  };
}

export function useEpisodeWatchToggle(episode: CalendarEpisode): (isWatched: boolean) => void {
  const { dict } = useTranslation();
  const markWatched = useOptimisticWatched(episode);

  return (isWatched) => {
    void markWatched(isWatched, true);
    const notice = isWatched ? dict.calendar.notice.watched : dict.calendar.notice.unwatched;
    showUndoToast({
      key: WATCH_TOAST_KEY,
      message: interpolate(notice, {
        show: episode.showTitle,
        code: calendarEpisodeCode(episode, dict),
      }),
      undoLabel: dict.episodes.notice.undo,
      onUndo: () => void markWatched(!isWatched),
    });
  };
}

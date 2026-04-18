import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import {
  useToggleEpisodeWatched,
  useMarkMultipleWatched,
} from '@/core/query';

type EpisodeDto = components['schemas']['EpisodeDto'];

interface UseEpisodeToggleParams {
  showId: string;
  isAuthenticated: boolean;
  dict: ReturnType<typeof getDictionary>;
  episodes: EpisodeDto[];
  watchedEpisodeIds: Set<string>;
  totalProgress: { watched: number; total: number };
}

export function useEpisodeToggle({
  showId,
  isAuthenticated,
  dict,
  episodes,
  watchedEpisodeIds,
  totalProgress,
}: UseEpisodeToggleParams) {
  const toggleWatched = useToggleEpisodeWatched(showId);
  const markMultipleWatched = useMarkMultipleWatched(showId);

  const [togglingEpisodeId, setTogglingEpisodeId] = useState<string | null>(null);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const clearAnimatingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAnimating = useCallback(
    () => setAnimatingIds((prev) => (prev.size > 0 ? new Set() : prev)),
    [],
  );

  const scheduleClearAnimating = useCallback(() => {
    if (clearAnimatingTimeoutRef.current !== null) {
      clearTimeout(clearAnimatingTimeoutRef.current);
    }
    clearAnimatingTimeoutRef.current = setTimeout(() => {
      clearAnimatingTimeoutRef.current = null;
      clearAnimating();
    }, 350);
  }, [clearAnimating]);

  // Cancel any pending clear-animating timer when the hook unmounts so we
  // never call setState on an unmounted component.
  useEffect(
    () => () => {
      if (clearAnimatingTimeoutRef.current !== null) {
        clearTimeout(clearAnimatingTimeoutRef.current);
      }
    },
    [],
  );

  const handleToggleWatched = useCallback(
    (episodeId: string, seasonNumber: number) => {
      if (!isAuthenticated || toggleWatched.isPending || markMultipleWatched.isPending) return;

      const isCurrentlyWatched = watchedEpisodeIds.has(episodeId);
      const wasCompleted = totalProgress.watched === totalProgress.total && totalProgress.total > 0;
      const prevWatched = totalProgress.watched;

      setTogglingEpisodeId(episodeId);

      if (!isCurrentlyWatched) {
        setAnimatingIds(new Set([episodeId]));
      }

      toggleWatched.mutate(
        {
          episodeId,
          seasonNumber,
          watched: !isCurrentlyWatched,
        },
        {
          onSuccess: () => {
            const newWatched = isCurrentlyWatched ? prevWatched - 1 : prevWatched + 1;
            const prevTotal = totalProgress.total;
            const isNowCompleted = newWatched === prevTotal && prevTotal > 0;

            if (!isCurrentlyWatched && isNowCompleted) {
              toast.success(dict.activity.toast.completed);
            } else if (!isCurrentlyWatched && prevWatched === 0) {
              toast.success(dict.activity.toast.addedToWatching);
            } else if (isCurrentlyWatched && wasCompleted) {
              toast.info(dict.activity.toast.backToWatching);
            } else if (isCurrentlyWatched && newWatched === 0) {
              toast.info(dict.activity.toast.removedFromActivity);
            }
          },
          onSettled: () => {
            setTogglingEpisodeId(null);
            scheduleClearAnimating();
          },
        },
      );
    },
    [
      isAuthenticated,
      toggleWatched,
      markMultipleWatched.isPending,
      watchedEpisodeIds,
      totalProgress,
      dict,
      scheduleClearAnimating,
    ],
  );

  const handleMarkWithPrevious = useCallback(
    (episodeIndex: number, seasonNumber: number) => {
      if (!isAuthenticated || markMultipleWatched.isPending || toggleWatched.isPending) return;

      const episodesToMark: string[] = [];
      for (let i = 0; i <= episodeIndex; i++) {
        const ep = episodes[i];
        if (ep.id && !watchedEpisodeIds.has(ep.id)) {
          episodesToMark.push(ep.id);
        }
      }

      if (episodesToMark.length === 0) return;

      const prevWatched = totalProgress.watched;
      setTogglingEpisodeId(episodesToMark[episodesToMark.length - 1]);
      setAnimatingIds(new Set(episodesToMark));

      markMultipleWatched.mutate(
        {
          episodeIds: episodesToMark,
          seasonNumber,
        },
        {
          onSuccess: () => {
            const newWatched = prevWatched + episodesToMark.length;
            const isNowCompleted = newWatched === totalProgress.total && totalProgress.total > 0;

            if (isNowCompleted) {
              toast.success(dict.activity.toast.completed);
            } else if (prevWatched === 0) {
              toast.success(dict.activity.toast.addedToWatching);
            }
          },
          onSettled: () => {
            setTogglingEpisodeId(null);
            scheduleClearAnimating();
          },
        },
      );
    },
    [
      isAuthenticated,
      markMultipleWatched,
      toggleWatched.isPending,
      episodes,
      watchedEpisodeIds,
      totalProgress,
      dict,
      scheduleClearAnimating,
    ],
  );

  const getUnwatchedPreviousCount = useCallback(
    (episodeIndex: number): number => {
      let count = 0;
      for (let i = 0; i < episodeIndex; i++) {
        const ep = episodes[i];
        if (ep.id && !watchedEpisodeIds.has(ep.id)) {
          count++;
        }
      }
      return count;
    },
    [episodes, watchedEpisodeIds],
  );

  return {
    togglingEpisodeId,
    animatingIds,
    handleToggleWatched,
    handleMarkWithPrevious,
    getUnwatchedPreviousCount,
  };
}

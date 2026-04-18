import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import {
  useMarkAllEpisodesWatched,
  useUnmarkEpisodes,
  useResetSeason,
} from '@/core/query';
import type { EpisodeProgressData } from './use-episode-progress';

type SeasonDto = components['schemas']['SeasonDto'];

interface UseCatchUpParams {
  showId: string;
  dict: ReturnType<typeof getDictionary>;
  validSeasons: SeasonDto[];
  progress: EpisodeProgressData;
  selectedSeason: SeasonDto | null;
}

export function useCatchUp({
  showId,
  dict,
  validSeasons,
  progress,
  selectedSeason,
}: UseCatchUpParams) {
  const { progressData, currentSeasonProgress, allEpisodesBySeasonNumber, totalEpisodesCount, totalAllEpisodes } = progress;

  const markAllWatched = useMarkAllEpisodesWatched(showId);
  const unmarkEpisodes = useUnmarkEpisodes(showId);
  const resetSeason = useResetSeason(showId);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);

  const previousWatchedIdsRef = useRef<Map<number, string[]> | null>(null);
  const selectedEpisodesRef = useRef<Map<number, string[]> | null>(null);
  const catchUpToastIdRef = useRef<string | number | null>(null);
  const resetEpisodeIdsRef = useRef<string[] | null>(null);
  const resetSeasonNumberRef = useRef<number | null>(null);

  const handleUndo = useCallback(() => {
    const previousWatched = previousWatchedIdsRef.current;
    const selectedEpisodes = selectedEpisodesRef.current;
    if (!previousWatched || !selectedEpisodes) return;

    const selectedEpisodeIds: string[] = [];
    selectedEpisodes.forEach((ids) => {
      selectedEpisodeIds.push(...ids);
    });

    const previouslyWatchedIds = new Set<string>();
    previousWatched.forEach((ids) => {
      ids.forEach((id) => previouslyWatchedIds.add(id));
    });

    const episodesToUnmark = selectedEpisodeIds.filter((id) => !previouslyWatchedIds.has(id));
    if (episodesToUnmark.length === 0) return;

    unmarkEpisodes.mutate(episodesToUnmark, {
      onSuccess: () => {
        toast.success(dict.details.showStatus.undone);
        previousWatchedIdsRef.current = null;
        selectedEpisodesRef.current = null;
      },
      onError: () => {
        toast.error(dict.common?.error || 'Щось пішло не так');
      },
    });
  }, [unmarkEpisodes, dict]);

  const handleCatchUpConfirm = useCallback(async (
    toMark: Map<number, string[]>,
    toUnmark: Map<number, string[]>,
  ) => {
    setShowConfirmDialog(false);

    if (progressData) {
      const prevMap = new Map<number, string[]>();
      progressData.seasons.forEach((s) => {
        prevMap.set(s.seasonNumber, [...s.watchedEpisodeIds]);
      });
      previousWatchedIdsRef.current = prevMap;
    }
    selectedEpisodesRef.current = toMark;

    try {
      if (toMark.size > 0) {
        let selectedLastSeason = 0;
        let selectedLastEpisode = 0;
        const now = Date.now();
        for (const season of validSeasons) {
          if (!toMark.has(season.number)) continue;
          for (const ep of season.episodes || []) {
            if (ep.airDate && new Date(ep.airDate).getTime() > now) continue;
            selectedLastSeason = season.number;
            selectedLastEpisode = ep.number;
          }
        }

        const selectedTotal = Array.from(toMark.values()).reduce((sum, ids) => sum + ids.length, 0);
        const isFullCatchUp = selectedTotal === totalEpisodesCount && totalEpisodesCount === totalAllEpisodes;

        await markAllWatched.mutateAsync({ episodesBySeasonNumber: toMark });

        const message = isFullCatchUp
          ? dict.details.showStatus.caughtUpAll
          : dict.details.showStatus.caughtUp
              .replace('{season}', String(selectedLastSeason))
              .replace('{episode}', String(selectedLastEpisode));

        if (toUnmark.size === 0) {
          catchUpToastIdRef.current = toast.success(message, {
            action: {
              label: dict.details.showStatus.undo,
              onClick: handleUndo,
            },
            duration: 8000,
          });
        } else {
          toast.success(message);
        }
      }

      if (toUnmark.size > 0) {
        const idsToUnmark: string[] = [];
        toUnmark.forEach((ids) => {
          idsToUnmark.push(...ids);
        });
        if (idsToUnmark.length > 0) {
          await unmarkEpisodes.mutateAsync(idsToUnmark);
        }

        if (toMark.size === 0) {
          toast.success(dict.details.showStatus.seasonReset);
        }

        previousWatchedIdsRef.current = null;
        selectedEpisodesRef.current = null;
      }
    } catch {
      toast.error(dict.common?.error || 'Щось пішло не так');
    }
  }, [progressData, validSeasons, markAllWatched, unmarkEpisodes, dict, handleUndo, totalEpisodesCount, totalAllEpisodes]);

  const handleMarkAllClick = useCallback(() => {
    if (validSeasons.length <= 1) {
      handleCatchUpConfirm(allEpisodesBySeasonNumber, new Map());
    } else {
      setShowConfirmDialog(true);
    }
  }, [validSeasons.length, handleCatchUpConfirm, allEpisodesBySeasonNumber]);

  const handleResetSeasonClick = useCallback(() => {
    resetEpisodeIdsRef.current = currentSeasonProgress?.watchedEpisodeIds?.slice() ?? null;
    resetSeasonNumberRef.current = selectedSeason?.number ?? null;
    setShowResetConfirmDialog(true);
  }, [currentSeasonProgress?.watchedEpisodeIds, selectedSeason?.number]);

  const handleConfirmResetSeason = useCallback(() => {
    setShowResetConfirmDialog(false);
    if (catchUpToastIdRef.current !== null) {
      toast.dismiss(catchUpToastIdRef.current);
      catchUpToastIdRef.current = null;
    }
    const ids = resetEpisodeIdsRef.current;
    const seasonNumber = resetSeasonNumberRef.current;
    resetEpisodeIdsRef.current = null;
    resetSeasonNumberRef.current = null;
    if (!ids || ids.length === 0 || seasonNumber === null) return;

    resetSeason.mutate(
      { episodeIds: ids, seasonNumber },
      {
        onSuccess: () => {
          toast.success(dict.details.showStatus.seasonReset);
        },
        onError: () => {
          toast.error(dict.common?.error || 'Щось пішло не так');
        },
      },
    );
  }, [resetSeason, dict]);

  return {
    showConfirmDialog,
    setShowConfirmDialog,
    showResetConfirmDialog,
    setShowResetConfirmDialog,
    handleCatchUpConfirm,
    handleMarkAllClick,
    handleResetSeasonClick,
    handleConfirmResetSeason,
    isMarkingAll: markAllWatched.isPending,
    isUnmarking: unmarkEpisodes.isPending,
    isResettingSeason: resetSeason.isPending,
  };
}

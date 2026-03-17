'use client';

/**
 * Episodes section for show details page.
 * Displays season selector with episode list and thumbnails.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';
import { cn } from '@/shared/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/shared/ui';
import { useAuth } from '@/core/auth';
import {
  useShowProgress,
  useToggleEpisodeWatched,
  useMarkMultipleWatched,
  useMarkAllEpisodesWatched,
  useUnmarkEpisodes,
} from '@/core/query';
import { useUserMediaState } from '@/modules/saved/hooks/use-me-lists';
import { CatchUpDialog } from './catch-up-dialog';
import { EpisodeCard } from './episode-card';
import { SeasonHeader } from './season-header';

type SeasonDto = components['schemas']['SeasonDto'];

export interface EpisodesSectionProps {
  seasons: SeasonDto[];
  nextEpisodeDate?: string | null;
  dict: ReturnType<typeof getDictionary>;
  /** Show ID (from shows table) for progress tracking */
  showId?: string;
  /** Media item ID for fetching user state (continuePoint) */
  mediaItemId?: string;
}

export function EpisodesSection({
  seasons,
  nextEpisodeDate,
  dict,
  showId,
  mediaItemId,
}: EpisodesSectionProps) {
  const { isAuthenticated } = useAuth();

  const { data: userMediaState } = useUserMediaState(mediaItemId ?? '', isAuthenticated && !!mediaItemId);
  const continueSeasonNumber = userMediaState?.continuePoint?.season;

  // Filter out seasons with no episodes and season 0 (specials)
  const validSeasons = useMemo(
    () => seasons.filter((s) => s.number > 0 && (s.episodes?.length || 0) > 0),
    [seasons],
  );

  // Default to last season, will be updated when continuePoint loads
  const [selectedSeason, setSelectedSeason] = useState<SeasonDto | null>(() => {
    if (validSeasons.length === 0) return null;
    return validSeasons[validSeasons.length - 1];
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [hasAppliedContinue, setHasAppliedContinue] = useState(false);

  useEffect(() => {
    if (continueSeasonNumber && !hasAppliedContinue && validSeasons.length > 0) {
      const targetSeason = validSeasons.find((s) => s.number === continueSeasonNumber);
      if (targetSeason) {
        setSelectedSeason(targetSeason);
        setIsExpanded(true);
        setHasAppliedContinue(true);
      }
    }
  }, [continueSeasonNumber, hasAppliedContinue, validSeasons]);

  // Ref for scrollable container
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleExpandEpisodes = (e: Event) => {
      const customEvent = e as CustomEvent<{ season?: number }>;
      const targetSeason = customEvent.detail?.season;

      setIsExpanded(true);

      if (targetSeason) {
        const season = validSeasons.find((s) => s.number === targetSeason);
        if (season) {
          setSelectedSeason(season);
        }
      }
    };

    window.addEventListener('expandEpisodes', handleExpandEpisodes);
    return () => window.removeEventListener('expandEpisodes', handleExpandEpisodes);
  }, [validSeasons]);

  // Episode progress tracking
  const { data: progressData } = useShowProgress(showId, {
    enabled: isAuthenticated && !!showId,
  });
  const toggleWatched = useToggleEpisodeWatched(showId || '');
  const markMultipleWatched = useMarkMultipleWatched(showId || '');
  const markAllWatched = useMarkAllEpisodesWatched(showId || '');
  const unmarkEpisodes = useUnmarkEpisodes(showId || '');

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);

  // Get watched episode IDs for current season
  // Simple .find() doesn't need useMemo per rerender-simple-expression-in-memo rule
  const currentSeasonProgress = progressData?.seasons.find(
    (s) => s.seasonNumber === selectedSeason?.number
  ) ?? null;

  const watchedEpisodeIds = useMemo(
    () => new Set(currentSeasonProgress?.watchedEpisodeIds || []),
    [currentSeasonProgress?.watchedEpisodeIds],
  );

  // Calculate total progress across all seasons
  const totalProgress = useMemo(() => {
    if (!progressData) return { watched: 0, total: 0 };
    return progressData.seasons.reduce(
      (acc, s) => ({
        watched: acc.watched + s.watchedCount,
        total: acc.total + s.totalCount,
      }),
      { watched: 0, total: 0 },
    );
  }, [progressData]);

  // Episodes list from selected season
  // Simple property access doesn't need useMemo per rerender-simple-expression-in-memo rule
  const episodes = selectedSeason?.episodes || [];

  // Collect all aired episode IDs grouped by season number, count totals, and track last aired episode
  // Combined iteration per js-combine-iterations rule
  const { allEpisodesBySeasonNumber, totalEpisodesCount, totalAllEpisodes, lastAiredEpisodeInfo } = useMemo(() => {
    const now = Date.now();
    const map = new Map<number, string[]>();
    let airedCount = 0;
    let allCount = 0;
    let lastSeason = 0;
    let lastEpisode = 0;

    for (const season of validSeasons) {
      const episodes = season.episodes || [];
      const ids: string[] = [];
      allCount += episodes.length;

      for (const ep of episodes) {
        // Skip episodes with future air dates
        // Cache property access per js-cache-property-access rule
        const airDate = ep.airDate;
        if (airDate && new Date(airDate).getTime() > now) continue;
        airedCount++;
        if (ep.id) ids.push(ep.id);
        // Track last aired episode for success message
        lastSeason = season.number;
        lastEpisode = ep.number;
      }

      if (ids.length > 0) {
        map.set(season.number, ids);
      }
    }

    return {
      allEpisodesBySeasonNumber: map,
      totalEpisodesCount: airedCount,
      totalAllEpisodes: allCount,
      lastAiredEpisodeInfo: { season: lastSeason, episode: lastEpisode },
    };
  }, [validSeasons]);

  // Store previous watched IDs and selected episodes for undo
  const previousWatchedIdsRef = useRef<Map<number, string[]> | null>(null);
  const selectedEpisodesRef = useRef<Map<number, string[]> | null>(null);

  const handleUndo = useCallback(() => {
    const previousWatched = previousWatchedIdsRef.current;
    const selectedEpisodes = selectedEpisodesRef.current;
    if (!previousWatched || !selectedEpisodes) return;

    // Compute episode IDs from selected seasons only
    const selectedEpisodeIds: string[] = [];
    selectedEpisodes.forEach((ids) => {
      selectedEpisodeIds.push(...ids);
    });

    // Get previously watched IDs as a set
    const previouslyWatchedIds = new Set<string>();
    previousWatched.forEach((ids) => {
      ids.forEach((id) => previouslyWatchedIds.add(id));
    });

    // Episodes to unmark = selected episodes that weren't watched before
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

  // Count seasons with unwatched aired episodes (for skip-dialog logic)
  const unwatchedSeasonCount = useMemo(() => {
    let count = 0;
    for (const [seasonNum, episodeIds] of allEpisodesBySeasonNumber) {
      const seasonProgress = progressData?.seasons.find((s) => s.seasonNumber === seasonNum);
      if (!seasonProgress || seasonProgress.watchedCount < episodeIds.length) {
        count++;
      }
    }
    return count;
  }, [allEpisodesBySeasonNumber, progressData]);

  const handleCatchUpConfirm = useCallback((selectedMap: Map<number, string[]>) => {
    setShowConfirmDialog(false);

    // Save previous state for undo
    if (progressData) {
      const prevMap = new Map<number, string[]>();
      progressData.seasons.forEach((s) => {
        prevMap.set(s.seasonNumber, [...s.watchedEpisodeIds]);
      });
      previousWatchedIdsRef.current = prevMap;
    }
    selectedEpisodesRef.current = selectedMap;

    // Derive last aired episode from selected seasons for toast
    let selectedLastSeason = 0;
    let selectedLastEpisode = 0;
    const now = Date.now();
    for (const season of validSeasons) {
      if (!selectedMap.has(season.number)) continue;
      for (const ep of season.episodes || []) {
        if (ep.airDate && new Date(ep.airDate).getTime() > now) continue;
        selectedLastSeason = season.number;
        selectedLastEpisode = ep.number;
      }
    }

    // Check if all aired episodes are being marked
    const selectedTotal = Array.from(selectedMap.values()).reduce((sum, ids) => sum + ids.length, 0);
    const isFullCatchUp = selectedTotal === totalEpisodesCount && totalEpisodesCount === totalAllEpisodes;

    markAllWatched.mutate(
      { episodesBySeasonNumber: selectedMap },
      {
        onSuccess: () => {
          const message = isFullCatchUp
            ? dict.details.showStatus.caughtUpAll
            : dict.details.showStatus.caughtUp
                .replace('{season}', String(selectedLastSeason))
                .replace('{episode}', String(selectedLastEpisode));

          toast.success(message, {
            action: {
              label: dict.details.showStatus.undo,
              onClick: handleUndo,
            },
            duration: 8000,
          });
        },
        onError: () => {
          toast.error(dict.common?.error || 'Щось пішло не так');
        },
      },
    );
  }, [progressData, validSeasons, markAllWatched, dict, handleUndo, totalEpisodesCount, totalAllEpisodes]);

  const handleMarkAllClick = useCallback(() => {
    if (unwatchedSeasonCount <= 1) {
      // Single season or single unwatched season: skip dialog
      handleCatchUpConfirm(allEpisodesBySeasonNumber);
    } else {
      setShowConfirmDialog(true);
    }
  }, [unwatchedSeasonCount, handleCatchUpConfirm, allEpisodesBySeasonNumber]);

  // Snapshot episode IDs at dialog-open time to prevent stale closure on season switch
  const resetEpisodeIdsRef = useRef<string[] | null>(null);

  const handleResetSeasonClick = useCallback(() => {
    resetEpisodeIdsRef.current = currentSeasonProgress?.watchedEpisodeIds?.slice() ?? null;
    setShowResetConfirmDialog(true);
  }, [currentSeasonProgress?.watchedEpisodeIds]);

  const handleConfirmResetSeason = useCallback(() => {
    setShowResetConfirmDialog(false);
    toast.dismiss(); // prevent collision with pending undo toasts
    const ids = resetEpisodeIdsRef.current;
    resetEpisodeIdsRef.current = null;
    if (!ids || ids.length === 0) return;

    unmarkEpisodes.mutate(ids, {
      onSuccess: () => {
        toast.success(dict.details.showStatus.seasonReset);
      },
      onError: () => {
        toast.error(dict.common?.error || 'Щось пішло не так');
      },
    });
  }, [unmarkEpisodes, dict]);

  // Track which episode is being toggled
  const [togglingEpisodeId, setTogglingEpisodeId] = useState<string | null>(null);

  // Track which episodes should animate (for bulk marking)
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());

  const handleToggleWatched = useCallback(
    (episodeId: string, seasonNumber: number) => {
      if (!isAuthenticated || toggleWatched.isPending || markMultipleWatched.isPending) return;

      const isCurrentlyWatched = watchedEpisodeIds.has(episodeId);
      const wasCompleted = totalProgress.watched === totalProgress.total && totalProgress.total > 0;
      const prevWatched = totalProgress.watched;

      setTogglingEpisodeId(episodeId);

      // Trigger animation for marking as watched
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

            // Show toast based on state transition
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
            // Clear animation after it completes
            setTimeout(() => setAnimatingIds(new Set()), 350);
          },
        },
      );
    },
    [isAuthenticated, toggleWatched, markMultipleWatched.isPending, watchedEpisodeIds, totalProgress, dict],
  );

  /**
   * Marks this episode + all unwatched previous episodes as watched.
   */
  const handleMarkWithPrevious = useCallback(
    (episodeIndex: number, seasonNumber: number) => {
      if (!isAuthenticated || markMultipleWatched.isPending || toggleWatched.isPending) return;

      // Get all unwatched episodes from start up to and including this one
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

      // Trigger animation for all episodes being marked
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
            // Clear animation after it completes
            setTimeout(() => setAnimatingIds(new Set()), 350);
          },
        },
      );
    },
    [isAuthenticated, markMultipleWatched, toggleWatched.isPending, episodes, watchedEpisodeIds, totalProgress, dict],
  );

  /**
   * Counts unwatched episodes before the given index.
   */
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

  // Find last aired episode index (only if there are upcoming episodes)
  // Moved above early return to comply with Rules of Hooks
  const lastAiredIndex = useMemo(() => {
    if (episodes.length === 0) return -1;

    const now = Date.now();
    let lastIndex = -1;
    let hasUpcoming = false;

    for (let i = 0; i < episodes.length; i++) {
      const airDate = episodes[i].airDate;
      if (airDate) {
        const airTime = new Date(airDate).getTime();
        if (airTime <= now) {
          lastIndex = i;
        } else {
          hasUpcoming = true;
        }
      }
    }

    // Only return index if there are upcoming episodes (not all aired)
    return hasUpcoming ? lastIndex : -1;
  }, [episodes]);

  // Episode card height for scroll calculations (64px card + 12px gap)
  const EPISODE_CARD_HEIGHT = 76;

  // Scroll to last aired episode when expanded
  useEffect(() => {
    if (isExpanded && lastAiredIndex > 0 && listRef.current) {
      // Wait for animation to complete
      const timer = setTimeout(() => {
        const container = listRef.current;
        if (!container) return;

        const scrollPosition = lastAiredIndex * EPISODE_CARD_HEIGHT;

        container.scrollTo({
          top: scrollPosition,
          behavior: 'smooth',
        });
      }, 350); // Slightly longer than animation duration

      return () => clearTimeout(timer);
    }
  }, [isExpanded, lastAiredIndex, selectedSeason]);

  // Don't render if no valid seasons
  if (!selectedSeason || validSeasons.length === 0) {
    return null;
  }

  return (
    <section id="episodes" className="space-y-4 scroll-mt-24">
      <h2 className="text-sm font-semibold text-cinema-text-muted uppercase tracking-wider">
        {dict.details.showStatus.sectionTitle}
      </h2>

      <div className="bg-cinema-card/30 rounded-2xl p-5 border border-cinema-borderSoft/50">
        {/* Next episode hint at top if available */}
        {nextEpisodeDate && (
          <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-cinema-borderSoft/30">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-sm text-cinema-text-muted">
              {dict.details.showStatus.nextEpisode}:
            </span>
            <span className="text-sm text-blue-400 font-medium">
              {formatDate(nextEpisodeDate)}
            </span>
          </div>
        )}

        {/* Season header with expand toggle */}
        <SeasonHeader
          seasons={validSeasons}
          selectedSeason={selectedSeason}
          onSeasonChange={setSelectedSeason}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded((prev) => !prev)}
          dict={dict}
          watchedCount={currentSeasonProgress?.watchedCount || 0}
          totalCount={currentSeasonProgress?.totalCount}
          showProgress={isAuthenticated && !!showId}
          totalWatched={totalProgress.watched}
          totalEpisodes={totalEpisodesCount}
          onMarkAllWatched={handleMarkAllClick}
          isMarkingAll={markAllWatched.isPending}
          onResetSeason={isAuthenticated && showId ? handleResetSeasonClick : undefined}
          isResettingSeason={unmarkEpisodes.isPending}
        />

        {/* Episodes list with smooth expand/collapse animation */}
        <div
          className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
          style={{
            gridTemplateRows: isExpanded ? '1fr' : '0fr',
            opacity: isExpanded ? 1 : 0,
          }}
        >
          <div className="overflow-hidden min-h-0">
            <div
              ref={listRef}
              className="max-h-[400px] overflow-y-auto scrollbar-thin mt-4 pt-4 pl-3 border-t border-cinema-borderSoft/30"
            >
              {episodes.map((episode, index) => (
                <EpisodeCard
                  key={episode.id || episode.number}
                  episode={episode}
                  dict={dict}
                  isWatched={episode.id ? watchedEpisodeIds.has(episode.id) : false}
                  onToggleWatched={
                    episode.id
                      ? () => handleToggleWatched(episode.id!, selectedSeason.number)
                      : undefined
                  }
                  onMarkWithPrevious={
                    episode.id
                      ? () => handleMarkWithPrevious(index, selectedSeason.number)
                      : undefined
                  }
                  unwatchedPreviousCount={getUnwatchedPreviousCount(index)}
                  isToggling={togglingEpisodeId === episode.id}
                  showCheckbox={isAuthenticated && !!showId && !!episode.id}
                  shouldAnimate={episode.id ? animatingIds.has(episode.id) : false}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Season selector dialog for catch-up */}
      <CatchUpDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        validSeasons={validSeasons}
        allEpisodesBySeasonNumber={allEpisodesBySeasonNumber}
        progressData={progressData}
        dict={dict}
        onConfirm={handleCatchUpConfirm}
        isPending={markAllWatched.isPending}
      />

      {/* Confirmation dialog for season reset */}
      <AlertDialog open={showResetConfirmDialog} onOpenChange={setShowResetConfirmDialog}>
        <AlertDialogContent className="bg-cinema-card border-cinema-borderSoft">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-cinema-text-primary">
              {dict.details.showStatus.resetSeason}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-cinema-text-muted">
              {(dict.details.showStatus.resetSeasonConfirm || '').replace(
                '{season}',
                selectedSeason?.name || `${dict.details.showStatus.season} ${selectedSeason?.number}`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-cinema-elevated text-cinema-text-secondary hover:bg-cinema-border hover:text-cinema-text-primary">
              {dict.common?.cancel || 'Скасувати'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmResetSeason}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {dict.details.showStatus.resetSeason}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

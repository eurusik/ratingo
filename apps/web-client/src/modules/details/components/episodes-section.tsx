'use client';

/**
 * Episodes section for show details page.
 * Displays season selector with episode list and thumbnails.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';
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
import { useUserMediaState } from '@/modules/saved/hooks/use-me-lists';
import { useEpisodeProgress } from '../hooks/use-episode-progress';
import { useCatchUp } from '../hooks/use-catch-up';
import { useEpisodeToggle } from '../hooks/use-episode-toggle';
import { CatchUpDialog } from './catch-up-dialog';
import { EpisodeCard } from './episode-card';
import { SeasonHeader } from './season-header';

type SeasonDto = components['schemas']['SeasonDto'];

export interface EpisodesSectionProps {
  seasons: SeasonDto[];
  nextEpisodeDate?: string | null;
  dict: ReturnType<typeof getDictionary>;
  showId?: string;
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

  const validSeasons = useMemo(
    () => seasons.filter((s) => s.number > 0 && (s.episodes?.length || 0) > 0),
    [seasons],
  );

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

  const episodes = selectedSeason?.episodes || [];

  const progress = useEpisodeProgress(
    showId,
    isAuthenticated && !!showId,
    validSeasons,
    selectedSeason?.number,
  );

  const {
    currentSeasonProgress,
    watchedEpisodeIds,
    totalProgress,
    progressData,
    allEpisodesBySeasonNumber,
    totalEpisodesCount,
  } = progress;

  const catchUp = useCatchUp({
    showId: showId || '',
    dict,
    validSeasons,
    progress,
    selectedSeason,
  });

  const {
    togglingEpisodeId,
    animatingIds,
    handleToggleWatched,
    handleMarkWithPrevious,
    getUnwatchedPreviousCount,
  } = useEpisodeToggle({
    showId: showId || '',
    isAuthenticated,
    dict,
    episodes,
    watchedEpisodeIds,
    totalProgress,
  });

  // Find last aired episode index (only if there are upcoming episodes)
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

    return hasUpcoming ? lastIndex : -1;
  }, [episodes]);

  const EPISODE_CARD_HEIGHT = 76;

  useEffect(() => {
    if (isExpanded && lastAiredIndex > 0 && listRef.current) {
      const timer = setTimeout(() => {
        const container = listRef.current;
        if (!container) return;

        container.scrollTo({
          top: lastAiredIndex * EPISODE_CARD_HEIGHT,
          behavior: 'smooth',
        });
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [isExpanded, lastAiredIndex, selectedSeason]);

  if (!selectedSeason || validSeasons.length === 0) {
    return null;
  }

  return (
    <section id="episodes" className="space-y-4 scroll-mt-24">
      <h2 className="text-sm font-semibold text-cinema-text-muted uppercase tracking-wider">
        {dict.details.showStatus.sectionTitle}
      </h2>

      <div className="bg-cinema-card/30 rounded-2xl p-5 border border-cinema-borderSoft/50">
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
          onMarkAllWatched={catchUp.handleMarkAllClick}
          isMarkingAll={catchUp.isMarkingAll}
          onResetSeason={isAuthenticated && showId ? catchUp.handleResetSeasonClick : undefined}
          isResettingSeason={catchUp.isResettingSeason}
        />

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

      <CatchUpDialog
        open={catchUp.showConfirmDialog}
        onOpenChange={catchUp.setShowConfirmDialog}
        validSeasons={validSeasons}
        allEpisodesBySeasonNumber={allEpisodesBySeasonNumber}
        progressData={progressData}
        dict={dict}
        onConfirm={catchUp.handleCatchUpConfirm}
        isPending={catchUp.isMarkingAll || catchUp.isUnmarking}
      />

      <AlertDialog open={catchUp.showResetConfirmDialog} onOpenChange={catchUp.setShowResetConfirmDialog}>
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
              onClick={catchUp.handleConfirmResetSeason}
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

'use client';

/**
 * Episodes section for show details page.
 * Displays season selector with episode list and thumbnails.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';
import { cn } from '@/shared/utils';
import { useAuth } from '@/core/auth';
import { useShowProgress, useToggleEpisodeWatched } from '@/core/query';
import { EpisodeCard } from './episode-card';
import { SeasonHeader } from './season-header';

type SeasonDto = components['schemas']['SeasonDto'];

export interface EpisodesSectionProps {
  seasons: SeasonDto[];
  nextEpisodeDate?: string | null;
  dict: ReturnType<typeof getDictionary>;
  /** Show ID (from shows table) for progress tracking */
  showId?: string;
}

export function EpisodesSection({
  seasons,
  nextEpisodeDate,
  dict,
  showId,
}: EpisodesSectionProps) {
  const { isAuthenticated } = useAuth();
  // Filter out seasons with no episodes and season 0 (specials)
  const validSeasons = useMemo(
    () => seasons.filter((s) => s.number > 0 && (s.episodes?.length || 0) > 0),
    [seasons],
  );

  // Default to first valid season or last season with episodes
  const [selectedSeason, setSelectedSeason] = useState<SeasonDto | null>(() => {
    if (validSeasons.length === 0) return null;
    // Start with the latest season
    return validSeasons[validSeasons.length - 1];
  });

  // Collapsed by default (like Apple TV+)
  const [isExpanded, setIsExpanded] = useState(false);

  // Ref for scrollable container
  const listRef = useRef<HTMLDivElement>(null);

  // Episode progress tracking
  const { data: progressData } = useShowProgress(showId, {
    enabled: isAuthenticated && !!showId,
  });
  const toggleWatched = useToggleEpisodeWatched(showId || '');

  // Get watched episode IDs for current season
  const currentSeasonProgress = useMemo(() => {
    if (!progressData || !selectedSeason) return null;
    return progressData.seasons.find((s) => s.seasonNumber === selectedSeason.number);
  }, [progressData, selectedSeason]);

  const watchedEpisodeIds = useMemo(
    () => new Set(currentSeasonProgress?.watchedEpisodeIds || []),
    [currentSeasonProgress],
  );

  // Track which episode is being toggled
  const [togglingEpisodeId, setTogglingEpisodeId] = useState<string | null>(null);

  const handleToggleWatched = useCallback(
    (episodeId: string, seasonNumber: number) => {
      if (!isAuthenticated || toggleWatched.isPending) return;

      const isCurrentlyWatched = watchedEpisodeIds.has(episodeId);
      setTogglingEpisodeId(episodeId);

      toggleWatched.mutate(
        {
          episodeId,
          seasonNumber,
          watched: !isCurrentlyWatched,
        },
        {
          onSettled: () => setTogglingEpisodeId(null),
        },
      );
    },
    [isAuthenticated, toggleWatched, watchedEpisodeIds],
  );

  // Don't render if no valid seasons
  if (!selectedSeason || validSeasons.length === 0) {
    return null;
  }

  const episodes = selectedSeason.episodes || [];

  // Find last aired episode index (only if there are upcoming episodes)
  const lastAiredIndex = useMemo(() => {
    const now = new Date();
    let lastIndex = -1;
    let hasUpcoming = false;

    for (let i = 0; i < episodes.length; i++) {
      const airDate = episodes[i].airDate;
      if (airDate && new Date(airDate) <= now) {
        lastIndex = i;
      } else if (airDate && new Date(airDate) > now) {
        hasUpcoming = true;
      }
    }

    // Only return index if there are upcoming episodes (not all aired)
    return hasUpcoming ? lastIndex : -1;
  }, [episodes]);

  // Scroll to last aired episode when expanded
  useEffect(() => {
    if (isExpanded && lastAiredIndex > 0 && listRef.current) {
      // Wait for animation to complete
      const timer = setTimeout(() => {
        const container = listRef.current;
        if (!container) return;

        // Each episode card is ~76px (64px height + 12px padding)
        const episodeHeight = 76;
        const scrollPosition = lastAiredIndex * episodeHeight;

        container.scrollTo({
          top: scrollPosition,
          behavior: 'smooth',
        });
      }, 350); // Slightly longer than animation duration

      return () => clearTimeout(timer);
    }
  }, [isExpanded, lastAiredIndex, selectedSeason]);

  return (
    <section className="space-y-4">
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
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          dict={dict}
          watchedCount={currentSeasonProgress?.watchedCount || 0}
          totalCount={currentSeasonProgress?.totalCount}
          showProgress={isAuthenticated && !!showId}
        />

        {/* Episodes list with collapse animation */}
        <div
          className={cn(
            'grid transition-all duration-300 ease-in-out',
            isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div
              ref={listRef}
              className="max-h-[400px] overflow-y-auto scrollbar-thin mt-4 pt-4 border-t border-cinema-borderSoft/30"
            >
              {episodes.map((episode) => (
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
                  isToggling={togglingEpisodeId === episode.id}
                  showCheckbox={isAuthenticated && !!showId && !!episode.id}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

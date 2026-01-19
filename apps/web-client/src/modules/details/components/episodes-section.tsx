'use client';

/**
 * Episodes section for show details page.
 * Displays season selector with episode list and thumbnails.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Tv, Clock } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';
import { cn, resolveMediaImageUrl, IMAGE_SIZES, pluralize } from '@/shared/utils';

type SeasonDto = components['schemas']['SeasonDto'];
type EpisodeDto = components['schemas']['EpisodeDto'];

export interface EpisodesSectionProps {
  seasons: SeasonDto[];
  nextEpisodeDate?: string | null;
  dict: ReturnType<typeof getDictionary>;
}

/**
 * Formats episode runtime.
 */
function formatRuntime(minutes: number | null | undefined, label: string): string | null {
  if (!minutes) return null;
  return `${minutes} ${label}`;
}

/**
 * Checks if episode is upcoming (air date in future).
 */
function isUpcoming(airDate: string | null | undefined): boolean {
  if (!airDate) return false;
  return new Date(airDate) > new Date();
}

/**
 * Episode card component.
 */
function EpisodeCard({
  episode,
  dict,
}: {
  episode: EpisodeDto;
  dict: ReturnType<typeof getDictionary>;
}) {
  const upcoming = isUpcoming(episode.airDate);
  const title = episode.title || dict.details.showStatus.noTitle.replace('{number}', String(episode.number));
  const runtime = formatRuntime(episode.runtime, dict.details.showStatus.minutes);

  return (
    <div
      className={cn(
        'flex gap-4 py-3 border-b border-cinema-borderSoft/30 last:border-b-0',
        upcoming && 'opacity-60',
      )}
    >
      {/* Episode thumbnail */}
      <div className="relative flex-shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-cinema-elevated">
        {resolveMediaImageUrl(episode.stillPath, IMAGE_SIZES.W300) ? (
          <Image
            src={resolveMediaImageUrl(episode.stillPath, IMAGE_SIZES.W300)!}
            alt={title}
            fill
            className="object-cover"
            sizes="112px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tv className="w-6 h-6 text-cinema-text-disabled" />
          </div>
        )}
        {upcoming && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-[10px] font-medium text-white uppercase tracking-wider">
              {dict.details.showStatus.upcoming}
            </span>
          </div>
        )}
      </div>

      {/* Episode info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-cinema-text-primary">
            {episode.number}. {title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-cinema-text-muted">
          {episode.airDate && <span>{formatDate(episode.airDate)}</span>}
          {episode.airDate && runtime && <span className="text-cinema-text-disabled">·</span>}
          {runtime && <span>{runtime}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Season header with poster, expand toggle, and dropdown.
 */
function SeasonHeader({
  seasons,
  selectedSeason,
  onSeasonChange,
  isExpanded,
  onToggleExpand,
  dict,
}: {
  seasons: SeasonDto[];
  selectedSeason: SeasonDto;
  onSeasonChange: (season: SeasonDto) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  dict: ReturnType<typeof getDictionary>;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const episodeCount = selectedSeason.episodeCount || selectedSeason.episodes?.length || 0;

  return (
    <button
      onClick={onToggleExpand}
      className={cn(
        'flex items-center gap-4 w-full text-left transition-colors',
        !isExpanded && 'hover:bg-cinema-elevated/30 -mx-2 px-2 py-2 rounded-xl',
      )}
    >
      {/* Season poster */}
      <div className="relative flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-cinema-elevated">
        {resolveMediaImageUrl(selectedSeason.posterPath, IMAGE_SIZES.W185) ? (
          <Image
            src={resolveMediaImageUrl(selectedSeason.posterPath, IMAGE_SIZES.W185)!}
            alt={selectedSeason.name || `${dict.details.showStatus.season} ${selectedSeason.number}`}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tv className="w-6 h-6 text-cinema-text-disabled" />
          </div>
        )}
      </div>

      {/* Season info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium text-cinema-text-primary">
            {selectedSeason.name || `${dict.details.showStatus.season} ${selectedSeason.number}`}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-cinema-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-cinema-text-muted" />
          )}
        </div>
        <div className="mt-1 text-sm text-cinema-text-muted">
          {episodeCount} {pluralize(episodeCount, dict.details.showStatus.plurals.episode)}
        </div>

        {/* Season dropdown (only when expanded and multiple seasons) */}
        {isExpanded && seasons.length > 1 && (
          <div className="relative mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="text-xs text-cinema-text-secondary hover:text-cinema-text-primary transition-colors"
            >
              {dict.details.showStatus.changeSeason || 'Змінити сезон'}
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                  }}
                />
                <div
                  className={cn(
                    'absolute top-full left-0 mt-2 z-20 bg-cinema-card rounded-xl border border-cinema-borderSoft shadow-xl overflow-hidden',
                    'max-h-[320px] overflow-y-auto',
                    seasons.length > 8 ? 'min-w-80 grid grid-cols-2' : 'min-w-48',
                  )}
                >
                  {seasons.map((season) => (
                    <button
                      key={season.number}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeasonChange(season);
                        setIsDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full px-4 py-3 text-left text-sm transition-colors',
                        season.number === selectedSeason.number
                          ? 'bg-cinema-elevated text-cinema-text-primary'
                          : 'text-cinema-text-secondary hover:bg-cinema-elevated/50',
                      )}
                    >
                      <div className="font-medium">
                        {season.name || `${dict.details.showStatus.season} ${season.number}`}
                      </div>
                      <div className="text-xs text-cinema-text-muted mt-0.5">
                        {season.episodeCount || season.episodes?.length || 0}{' '}
                        {pluralize(
                          season.episodeCount || season.episodes?.length || 0,
                          dict.details.showStatus.plurals.episode,
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

export function EpisodesSection({ seasons, nextEpisodeDate, dict }: EpisodesSectionProps) {
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
              className="max-h-[400px] overflow-y-auto pr-1 -mr-1 mt-4 pt-4 border-t border-cinema-borderSoft/30"
            >
              {episodes.map((episode) => (
                <EpisodeCard key={episode.number} episode={episode} dict={dict} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

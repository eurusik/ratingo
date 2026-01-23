'use client';

/**
 * Season header with poster, expand toggle, and dropdown.
 */

import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Tv, CheckCircle2, Loader2 } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { cn, resolveMediaImageUrl, IMAGE_SIZES, pluralize } from '@/shared/utils';
import { Button } from '@/shared/ui';
import { SeasonSelector } from './season-selector';
import { SeasonProgressRing } from './season-progress-ring';

type SeasonDto = components['schemas']['SeasonDto'];

export interface SeasonHeaderProps {
  seasons: SeasonDto[];
  selectedSeason: SeasonDto;
  onSeasonChange: (season: SeasonDto) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  dict: ReturnType<typeof getDictionary>;
  /** Number of watched episodes in this season */
  watchedCount?: number;
  /** Total episodes in this season (for progress) */
  totalCount?: number;
  /** Whether to show the progress ring */
  showProgress?: boolean;
  /** Total watched across all seasons */
  totalWatched?: number;
  /** Total episodes across all seasons */
  totalEpisodes?: number;
  /** Handler for "mark all watched" */
  onMarkAllWatched?: () => void;
  /** Whether mark all mutation is pending */
  isMarkingAll?: boolean;
}

export function SeasonHeader({
  seasons,
  selectedSeason,
  onSeasonChange,
  isExpanded,
  onToggleExpand,
  dict,
  watchedCount = 0,
  totalCount,
  showProgress = false,
  totalWatched = 0,
  totalEpisodes = 0,
  onMarkAllWatched,
  isMarkingAll = false,
}: SeasonHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const episodeCount = selectedSeason.episodeCount || selectedSeason.episodes?.length || 0;
  const progressTotal = totalCount ?? episodeCount;

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-season-dropdown]') || target.closest('[data-mark-all-button]')) {
      return;
    }
    onToggleExpand();
  };

  const showMarkAllButton = onMarkAllWatched && totalWatched < totalEpisodes;

  return (
    <div
      onClick={handleContainerClick}
      className={cn(
        'text-left transition-colors cursor-pointer',
        !isExpanded && 'hover:bg-cinema-elevated/30 -mx-2 px-2 py-2 rounded-xl',
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand();
        }
      }}
    >
      {/* Main row: poster + info + progress (desktop) */}
      <div className="flex items-center gap-4">
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
            <div className="relative mt-2" data-season-dropdown>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                className="text-xs text-cinema-text-secondary hover:text-cinema-text-primary transition-colors"
              >
                {dict.details.showStatus.changeSeason}
              </button>

              {isDropdownOpen && (
                <SeasonSelector
                  seasons={seasons}
                  selectedSeason={selectedSeason}
                  onSeasonChange={onSeasonChange}
                  onClose={() => setIsDropdownOpen(false)}
                  dict={dict}
                />
              )}
            </div>
          )}
        </div>

        {/* Desktop: Progress ring + small button */}
        {showProgress && progressTotal > 0 && (
          <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0">
            <SeasonProgressRing
              watched={watchedCount}
              total={progressTotal}
              size="md"
            />
            {showMarkAllButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAllWatched();
                }}
                disabled={isMarkingAll}
                className="h-auto py-0.5 px-1.5 text-[11px] text-cinema-text-muted hover:text-cinema-text-primary"
                data-mark-all-button
              >
                {isMarkingAll ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                )}
                {dict.details.showStatus.markAllWatched}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Mobile: Text progress + full-width button stacked */}
      {showProgress && progressTotal > 0 && (
        <div className="md:hidden mt-3 space-y-2">
          <div className="text-sm text-cinema-text-muted">
            {totalWatched}/{totalEpisodes} {dict.details.showStatus.watched}
          </div>
          {showMarkAllButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAllWatched();
              }}
              disabled={isMarkingAll}
              className="w-full justify-center"
              data-mark-all-button
            >
              {isMarkingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {dict.details.showStatus.markAllWatched}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

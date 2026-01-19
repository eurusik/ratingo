'use client';

/**
 * Season header with poster, expand toggle, and dropdown.
 */

import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Tv } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { cn, resolveMediaImageUrl, IMAGE_SIZES, pluralize } from '@/shared/utils';
import { SeasonSelector } from './season-selector';

type SeasonDto = components['schemas']['SeasonDto'];

export interface SeasonHeaderProps {
  seasons: SeasonDto[];
  selectedSeason: SeasonDto;
  onSeasonChange: (season: SeasonDto) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  dict: ReturnType<typeof getDictionary>;
}

export function SeasonHeader({
  seasons,
  selectedSeason,
  onSeasonChange,
  isExpanded,
  onToggleExpand,
  dict,
}: SeasonHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const episodeCount = selectedSeason.episodeCount || selectedSeason.episodes?.length || 0;

  const handleContainerClick = (e: React.MouseEvent) => {
    // Only toggle if not clicking the change season button
    if (!(e.target as HTMLElement).closest('[data-season-dropdown]')) {
      onToggleExpand();
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={cn(
        'flex items-center gap-4 w-full text-left transition-colors cursor-pointer',
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
    </div>
  );
}

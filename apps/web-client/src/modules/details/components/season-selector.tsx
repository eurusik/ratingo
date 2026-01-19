'use client';

/**
 * Season selector dropdown with quick access + grouped ranges.
 * Optimized for shows with many seasons (like The Simpsons).
 */

import { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { cn } from '@/shared/utils';

type SeasonDto = components['schemas']['SeasonDto'];

export interface SeasonSelectorProps {
  seasons: SeasonDto[];
  selectedSeason: SeasonDto;
  onSeasonChange: (season: SeasonDto) => void;
  onClose: () => void;
  dict: ReturnType<typeof getDictionary>;
}

/**
 * Season button - visual accent with big number + small badge.
 */
function SeasonButton({
  season,
  isSelected,
  isCurrent,
  label,
  onClick,
}: {
  season: SeasonDto;
  isSelected: boolean;
  isCurrent?: boolean;
  label?: string;
  onClick: () => void;
}) {
  const episodeCount = season.episodeCount || season.episodes?.length || 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left',
        isSelected
          ? 'bg-cinema-elevated text-cinema-text-primary'
          : 'text-cinema-text-secondary hover:bg-cinema-elevated/50',
      )}
    >
      <span
        className={cn(
          'text-xl font-bold min-w-[2.5rem] text-center',
          isCurrent && 'text-blue-400',
        )}
      >
        {season.number}
      </span>
      <div className="flex-1 min-w-0">
        {label && <div className="text-xs text-cinema-text-muted">{label}</div>}
        <div className="text-xs text-cinema-text-disabled">{episodeCount} ep</div>
      </div>
    </button>
  );
}

export function SeasonSelector({
  seasons,
  selectedSeason,
  onSeasonChange,
  onClose,
  dict,
}: SeasonSelectorProps) {
  const [expandedRange, setExpandedRange] = useState<string | null>(null);

  // Get quick access seasons
  const lastSeason = seasons[seasons.length - 1];
  const firstSeason = seasons[0];
  const currentSeason = selectedSeason;

  // Build unique quick access list (no duplicates)
  const quickAccess = useMemo(() => {
    const unique = new Map<number, { season: SeasonDto; label: string }>();

    unique.set(currentSeason.number, {
      season: currentSeason,
      label: dict.details.showStatus.currentSeason || 'Поточний',
    });

    if (lastSeason.number !== currentSeason.number) {
      unique.set(lastSeason.number, {
        season: lastSeason,
        label: dict.details.showStatus.lastSeason || 'Останній',
      });
    }

    if (firstSeason.number !== currentSeason.number && firstSeason.number !== lastSeason.number) {
      unique.set(firstSeason.number, {
        season: firstSeason,
        label: dict.details.showStatus.firstSeason || 'Перший',
      });
    }

    return Array.from(unique.values());
  }, [currentSeason, lastSeason, firstSeason, dict]);

  // Build season ranges (groups of 10)
  const ranges = useMemo(() => {
    if (seasons.length <= 6) return null; // No need for ranges with few seasons

    const groups: { label: string; seasons: SeasonDto[] }[] = [];
    const rangeSize = 10;

    for (let i = 0; i < seasons.length; i += rangeSize) {
      const rangeSeasons = seasons.slice(i, i + rangeSize);
      const start = rangeSeasons[0].number;
      const end = rangeSeasons[rangeSeasons.length - 1].number;
      groups.push({
        label: start === end ? `${start}` : `${start}–${end}`,
        seasons: rangeSeasons,
      });
    }

    return groups;
  }, [seasons]);

  const handleSelect = (season: SeasonDto) => {
    onSeasonChange(season);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute top-full left-0 mt-2 z-20 w-64 bg-cinema-card rounded-xl border border-cinema-borderSoft shadow-xl overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto">
          {/* Quick access */}
          <div className="p-2 border-b border-cinema-borderSoft/50">
            {quickAccess.map(({ season, label }) => (
              <SeasonButton
                key={season.number}
                season={season}
                isSelected={season.number === selectedSeason.number}
                isCurrent={season.number === currentSeason.number}
                label={label}
                onClick={() => handleSelect(season)}
              />
            ))}
          </div>

          {/* All seasons - simple list or grouped ranges */}
          {ranges ? (
            <div className="p-2">
              <div className="text-xs text-cinema-text-disabled uppercase tracking-wider px-3 py-2">
                {dict.details.showStatus.allSeasons || 'Всі сезони'}
              </div>
              {ranges.map((range) => (
                <div key={range.label}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedRange(expandedRange === range.label ? null : range.label);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm text-cinema-text-secondary hover:bg-cinema-elevated/50 rounded-lg transition-colors"
                  >
                    <span>
                      {dict.details.showStatus.seasons || 'Сезони'} {range.label}
                    </span>
                    <ChevronRight
                      className={cn(
                        'w-4 h-4 transition-transform',
                        expandedRange === range.label && 'rotate-90',
                      )}
                    />
                  </button>
                  {expandedRange === range.label && (
                    <div className="ml-2 border-l border-cinema-borderSoft/50 pl-2">
                      {range.seasons.map((season) => (
                        <SeasonButton
                          key={season.number}
                          season={season}
                          isSelected={season.number === selectedSeason.number}
                          onClick={() => handleSelect(season)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2">
              <div className="text-xs text-cinema-text-disabled uppercase tracking-wider px-3 py-2">
                {dict.details.showStatus.allSeasons || 'Всі сезони'}
              </div>
              {seasons
                .filter(
                  (s) => !quickAccess.some((qa) => qa.season.number === s.number),
                )
                .map((season) => (
                  <SeasonButton
                    key={season.number}
                    season={season}
                    isSelected={season.number === selectedSeason.number}
                    onClick={() => handleSelect(season)}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

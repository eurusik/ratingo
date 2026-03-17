'use client';

/**
 * Season selector dialog for the "Наздогнати" (catch-up) action.
 * Lets users choose which seasons to mark as watched.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { components } from '@ratingo/api-contract';
import type { ShowProgressDto } from '@/core/api/episode-progress.client';
import type { getDictionary } from '@/shared/i18n';
import { pluralize } from '@/shared/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  Checkbox,
  ScrollArea,
} from '@/shared/ui';

type SeasonDto = components['schemas']['SeasonDto'];

const SCROLL_THRESHOLD = 6;

export interface CatchUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validSeasons: SeasonDto[];
  allEpisodesBySeasonNumber: Map<number, string[]>;
  progressData: ShowProgressDto | undefined;
  dict: ReturnType<typeof getDictionary>;
  onConfirm: (
    toMark: Map<number, string[]>,
    toUnmark: Map<number, string[]>,
  ) => void;
  isPending: boolean;
}

interface SeasonRow {
  number: number;
  name: string;
  airedCount: number;
  watchedCount: number;
  isFullyWatched: boolean;
}

export function CatchUpDialog({
  open,
  onOpenChange,
  validSeasons,
  allEpisodesBySeasonNumber,
  progressData,
  dict,
  onConfirm,
  isPending,
}: CatchUpDialogProps) {
  const seasonRows = useMemo<SeasonRow[]>(() => {
    return validSeasons
      .filter((s) => allEpisodesBySeasonNumber.has(s.number))
      .map((s) => {
        const airedCount = allEpisodesBySeasonNumber.get(s.number)?.length ?? 0;
        const seasonProgress = progressData?.seasons.find(
          (sp) => sp.seasonNumber === s.number,
        );
        const watchedCount = seasonProgress?.watchedCount ?? 0;

        return {
          number: s.number,
          name: s.name || `${dict.details.showStatus.season} ${s.number}`,
          airedCount,
          watchedCount,
          isFullyWatched: airedCount > 0 && watchedCount >= airedCount,
        };
      });
  }, [validSeasons, allEpisodesBySeasonNumber, progressData, dict]);

  // Pre-select all seasons that have any watched or unwatched aired episodes
  const defaultSelected = useMemo(() => {
    return new Set(seasonRows.map((r) => r.number));
  }, [seasonRows]);

  const [selectedSeasons, setSelectedSeasons] = useState<Set<number>>(new Set());

  // Reset selection every time the dialog opens (fixes stale state on re-open)
  useEffect(() => {
    if (open) {
      setSelectedSeasons(new Set(defaultSelected));
    }
  }, [open, defaultSelected]);

  const toggleSeason = useCallback((seasonNumber: number) => {
    setSelectedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) {
        next.delete(seasonNumber);
      } else {
        next.add(seasonNumber);
      }
      return next;
    });
  }, []);

  const allSelected = seasonRows.length > 0
    && seasonRows.every((r) => selectedSeasons.has(r.number));
  const someSelected = selectedSeasons.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedSeasons(new Set());
    } else {
      setSelectedSeasons(new Set(seasonRows.map((r) => r.number)));
    }
  }, [allSelected, seasonRows]);

  const { totalToMark, totalToUnmark } = useMemo(() => {
    let toMark = 0;
    let toUnmark = 0;
    for (const row of seasonRows) {
      const isSelected = selectedSeasons.has(row.number);
      if (isSelected && !row.isFullyWatched) {
        toMark += Math.max(0, row.airedCount - row.watchedCount);
      } else if (!isSelected && row.isFullyWatched) {
        toUnmark += row.watchedCount;
      }
    }
    return { totalToMark: toMark, totalToUnmark: toUnmark };
  }, [selectedSeasons, seasonRows]);

  const handleConfirm = useCallback(() => {
    const toMark = new Map<number, string[]>();
    const toUnmark = new Map<number, string[]>();

    for (const row of seasonRows) {
      const ids = allEpisodesBySeasonNumber.get(row.number);
      if (!ids) continue;

      const isSelected = selectedSeasons.has(row.number);

      if (isSelected && !row.isFullyWatched) {
        toMark.set(row.number, ids);
      } else if (!isSelected && row.isFullyWatched) {
        const watchedIds = progressData?.seasons.find(
          (s) => s.seasonNumber === row.number,
        )?.watchedEpisodeIds;
        if (watchedIds?.length) {
          toUnmark.set(row.number, watchedIds);
        }
      }
    }

    onConfirm(toMark, toUnmark);
  }, [selectedSeasons, seasonRows, allEpisodesBySeasonNumber, progressData, onConfirm]);

  const showStatus = dict.details.showStatus;
  const needsScroll = seasonRows.length > SCROLL_THRESHOLD;

  const seasonListContent = (
    <SeasonList
      seasonRows={seasonRows}
      selectedSeasons={selectedSeasons}
      onToggle={toggleSeason}
      onToggleAll={seasonRows.length > 1 ? toggleAll : undefined}
      allSelected={allSelected}
      someSelected={someSelected}
      dict={dict}
    />
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-cinema-card border-cinema-borderSoft">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-cinema-text-primary">
            {showStatus.confirmMarkAll}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-cinema-text-muted">
            {showStatus.selectSeasonsMessage}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Season list with master checkbox */}
        {needsScroll ? (
          <ScrollArea className="max-h-[300px]">{seasonListContent}</ScrollArea>
        ) : (
          seasonListContent
        )}

        {/* Summary — live region for screen readers */}
        <p
          className="text-sm text-cinema-text-muted"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {totalToMark > 0 || totalToUnmark > 0
            ? [
                totalToMark > 0 && showStatus.willBeMarked
                  .replace('{count}', String(totalToMark))
                  .replace('{episodes}', pluralize(totalToMark, showStatus.plurals.episode)),
                totalToUnmark > 0 && showStatus.willBeUnmarked
                  .replace('{count}', String(totalToUnmark))
                  .replace('{episodes}', pluralize(totalToUnmark, showStatus.plurals.episode)),
              ].filter(Boolean).join('. ')
            : '\u00A0'}
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-cinema-elevated text-cinema-text-secondary hover:bg-cinema-border hover:text-cinema-text-primary">
            {dict.common?.cancel || 'Скасувати'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending || (totalToMark === 0 && totalToUnmark === 0)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {totalToUnmark > 0 ? dict.common?.save : showStatus.markAllWatched}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// Season list
// ============================================================================

interface SeasonListProps {
  seasonRows: SeasonRow[];
  selectedSeasons: Set<number>;
  onToggle: (seasonNumber: number) => void;
  onToggleAll?: () => void;
  allSelected: boolean;
  someSelected: boolean;
  dict: ReturnType<typeof getDictionary>;
}

function SeasonList({
  seasonRows,
  selectedSeasons,
  onToggle,
  onToggleAll,
  allSelected,
  someSelected,
  dict,
}: SeasonListProps) {
  const showStatus = dict.details.showStatus;

  return (
    <div className="space-y-1" role="group" aria-label={showStatus.allSeasons}>
      {/* Master checkbox */}
      {onToggleAll && (
        <>
          <label className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-cinema-elevated/30 cursor-pointer transition-colors">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={onToggleAll}
            />
            <span className="text-sm font-medium text-cinema-text-primary">
              {showStatus.allSeasons}
            </span>
          </label>
          <div className="border-b border-cinema-borderSoft/30 mx-2" />
        </>
      )}

      {seasonRows.map((row) => (
        <label
          key={row.number}
          className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-cinema-elevated/30 cursor-pointer transition-colors"
        >
          <Checkbox
            checked={selectedSeasons.has(row.number)}
            onCheckedChange={() => onToggle(row.number)}
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm text-cinema-text-primary">{row.name}</span>
            <span className="text-xs text-cinema-text-muted ml-2">
              {row.airedCount} {pluralize(row.airedCount, showStatus.plurals.episode)}
            </span>
          </div>
          {row.isFullyWatched ? (
            <span className="text-xs text-emerald-400/90">{showStatus.seasonFullyWatched}</span>
          ) : row.watchedCount > 0 ? (
            <span className="text-xs text-cinema-text-muted">
              {row.watchedCount}/{row.airedCount}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  );
}

'use client';

import { useQueries } from '@tanstack/react-query';
import { Button, EmptyState } from '@heroui/react';
import { SearchX } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { BrowseCategory } from '../model/browse-category';
import { removalLabel, useCountLabel } from '../model/browse-labels';
import { browseCountQuery } from '../model/browse-queries';
import { NO_FILTERS, type BrowseFilters, type BrowseState } from '../model/browse-state';
import { bestRemoval, filterRemovals } from '../model/filter-removals';
import type { YearPreset } from '../model/year-presets';

const MAX_SUGGESTION_CHECKS = 5;

interface EmptyResultsProps {
  category: BrowseCategory;
  state: BrowseState;
  yearPresets: readonly YearPreset[];
  onChangeFilters: (next: BrowseFilters) => void;
}

export function EmptyResults({
  category,
  state,
  yearPresets,
  onChangeFilters,
}: EmptyResultsProps) {
  const { dict } = useTranslation();
  const labels = dict.browse.empty;
  const countLabel = useCountLabel(category.type);
  const candidates = filterRemovals(state.filters).slice(0, MAX_SUGGESTION_CHECKS);
  const totals = useQueries({
    queries: candidates.map((removal) =>
      browseCountQuery(category.slug, { sort: state.sort, filters: removal.next }),
    ),
  });
  const best = bestRemoval(
    candidates.map((removal, index) => ({ removal, total: totals[index]?.data ?? 0 })),
  );

  return (
    <EmptyState className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-5 py-8 text-center md:max-w-md">
      <SearchX aria-hidden className="size-10 text-muted" />
      <h2 className="text-xl font-extrabold tracking-tight">{labels.title}</h2>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted">{labels.plain}</p>
      ) : (
        <>
          <p className="text-sm text-muted">{labels.body}</p>
          <div aria-live="polite" className="flex min-h-13 w-full">
            {best ? (
              <Button
                variant="primary"
                fullWidth
                className="h-auto min-h-13 flex-col gap-0.5 py-2"
                onPress={() => onChangeFilters(best.removal.next)}
              >
                <span className="font-semibold">
                  {interpolate(labels.remove, {
                    label: removalLabel(dict, yearPresets, best.removal),
                  })}
                </span>
                <span className="text-xs font-normal opacity-85">
                  {interpolate(labels.result, { result: countLabel(best.total) })}
                </span>
              </Button>
            ) : null}
          </div>
          <Button variant="secondary" fullWidth onPress={() => onChangeFilters(NO_FILTERS)}>
            {labels.reset}
          </Button>
        </>
      )}
    </EmptyState>
  );
}

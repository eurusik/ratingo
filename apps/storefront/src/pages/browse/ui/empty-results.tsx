'use client';

import { useQueries } from '@tanstack/react-query';
import { Button, EmptyState } from '@heroui/react';
import { SearchX } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { fetchBrowseTotal } from '../api/browse-client';
import type { BrowseCategory } from '../model/browse-category';
import { browseCountKey } from '../model/browse-keys';
import { NO_FILTERS, type BrowseFilters, type BrowseState } from '../model/browse-state';
import { countLabel, removalLabel } from '../model/filter-labels';
import { filterRemovals } from '../model/filter-removals';
import { BROWSE_COUNT_STALE_MS } from '../model/use-browse-count';
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
  const { dict, locale } = useTranslation();
  const labels = dict.browse.empty;
  const removals = filterRemovals(state.filters);
  const candidates = removals.slice(0, MAX_SUGGESTION_CHECKS);
  const totals = useQueries({
    queries: candidates.map((removal) => {
      const next = { sort: state.sort, filters: removal.next };
      return {
        queryKey: browseCountKey(category.slug, next),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          fetchBrowseTotal(category.slug, next, signal),
        staleTime: BROWSE_COUNT_STALE_MS,
      };
    }),
  });

  const best = candidates
    .map((removal, index) => ({ removal, total: totals[index]?.data ?? 0 }))
    .filter(({ total }) => total > 0)
    .sort((left, right) => right.total - left.total)[0];

  return (
    <EmptyState className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-5 py-8 text-center md:max-w-md">
      <SearchX aria-hidden className="size-10 text-muted" />
      <h2 className="text-xl font-extrabold tracking-tight">{labels.title}</h2>
      {removals.length === 0 ? (
        <p className="text-sm text-muted">{labels.plain}</p>
      ) : (
        <>
          <p className="text-sm text-muted">{labels.body}</p>
          {best ? (
            <Button
              variant="primary"
              fullWidth
              className="h-auto min-h-13 flex-col gap-0.5 py-2"
              onPress={() => onChangeFilters(best.removal.next)}
            >
              <span className="font-semibold">
                {interpolate(labels.remove, {
                  label: removalLabel(dict, yearPresets, state.filters, best.removal),
                })}
              </span>
              <span className="text-xs font-normal opacity-85">
                {interpolate(labels.result, {
                  result: countLabel(dict, locale, category.type, best.total),
                })}
              </span>
            </Button>
          ) : null}
          <Button variant="secondary" fullWidth onPress={() => onChangeFilters(NO_FILTERS)}>
            {labels.reset}
          </Button>
        </>
      )}
    </EmptyState>
  );
}

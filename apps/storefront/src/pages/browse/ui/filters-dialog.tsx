'use client';

import { Suspense, use, useMemo, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { SlidersHorizontal } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ResponsiveDialog } from '@/shared/ui';
import type { BrowseCategory } from '../model/browse-category';
import { useCountLabel } from '../model/browse-labels';
import { activeFilterCount, type BrowseFilters, type BrowseState } from '../model/browse-state';
import type { FirstPageResult } from '../model/first-page';
import { useBrowseCount } from '../model/use-browse-count';
import type { YearPreset } from '../model/year-presets';
import { FilterFields } from './filter-fields';
import { ResetFiltersButton } from './reset-filters-button';

interface ApplyButtonProps {
  category: BrowseCategory;
  loadedState: BrowseState;
  draft: BrowseState;
  firstPage: Promise<FirstPageResult>;
  onApply: () => void;
}

function ApplyButton({ category, loadedState, draft, firstPage, onApply }: ApplyButtonProps) {
  const { dict } = useTranslation();
  const labels = dict.browse.filters;
  const countLabel = useCountLabel(category.type);
  const result = use(firstPage);
  const knownTotal =
    result.status === 'loaded' ? { state: loadedState, total: result.page.total } : undefined;
  const { count, isUpdating, isUnavailable } = useBrowseCount(
    category.slug,
    draft,
    knownTotal,
    true,
  );

  const label = () => {
    if (isUnavailable) return labels.showUncounted;
    if (count === undefined) return labels.counting;
    if (count === 0) return labels.nothingFound;
    return interpolate(labels.show, { result: countLabel(count) });
  };

  return (
    <>
      <Button
        variant="primary"
        className="flex-1"
        onPress={onApply}
        isDisabled={count === 0 && !isUpdating}
        aria-busy={isUpdating}
      >
        {label()}
      </Button>
      <span aria-live="polite" className="sr-only">
        {isUpdating ? '' : label()}
      </span>
    </>
  );
}

interface FiltersDialogProps {
  category: BrowseCategory;
  state: BrowseState;
  loadedState: BrowseState;
  firstPage: Promise<FirstPageResult>;
  yearPresets: readonly YearPreset[];
  onApply: (filters: BrowseFilters) => void;
}

export function FiltersDialog({
  category,
  state,
  loadedState,
  firstPage,
  yearPresets,
  onApply,
}: FiltersDialogProps) {
  const { dict } = useTranslation();
  const labels = dict.browse.filters;
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<BrowseFilters>(state.filters);
  const draftState = useMemo(() => ({ sort: state.sort, filters: draft }), [state.sort, draft]);
  const activeCount = activeFilterCount(state.filters);

  const open = () => {
    setDraft(state.filters);
    setIsOpen(true);
  };

  const apply = () => {
    setIsOpen(false);
    onApply(draft);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onPress={open}
        aria-label={
          activeCount > 0 ? interpolate(labels.openActive, { count: activeCount }) : labels.open
        }
        className="min-h-10 min-w-10 shrink-0 gap-1.5 rounded-full px-2.5 sm:px-3.5"
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        <span className="hidden sm:inline">{labels.open}</span>
        {activeCount > 0 ? (
          <Chip aria-hidden size="sm" color="accent" variant="primary" className="tabular-nums">
            {activeCount}
          </Chip>
        ) : null}
      </Button>
      <ResponsiveDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={labels.title}
        footer={
          <div className="flex w-full gap-2">
            <ResetFiltersButton filters={draft} variant="secondary" onReset={setDraft} />
            <Suspense
              fallback={
                <Button variant="primary" className="flex-1" isDisabled>
                  {labels.counting}
                </Button>
              }
            >
              <ApplyButton
                category={category}
                loadedState={loadedState}
                draft={draftState}
                firstPage={firstPage}
                onApply={apply}
              />
            </Suspense>
          </div>
        }
      >
        <FilterFields
          type={category.type}
          filters={draft}
          yearPresets={yearPresets}
          onChange={setDraft}
        />
      </ResponsiveDialog>
    </>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { SlidersHorizontal } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ResponsiveDialog } from '@/shared/ui';
import type { BrowseCategory } from '../model/browse-category';
import {
  NO_FILTERS,
  activeFilterCount,
  type BrowseFilters,
  type BrowseState,
} from '../model/browse-state';
import { countLabel } from '../model/filter-labels';
import { useBrowseCount } from '../model/use-browse-count';
import type { YearPreset } from '../model/year-presets';
import { FilterFields } from './filter-fields';

interface FiltersDialogProps {
  category: BrowseCategory;
  state: BrowseState;
  yearPresets: readonly YearPreset[];
  onApply: (filters: BrowseFilters) => void;
}

export function FiltersDialog({ category, state, yearPresets, onApply }: FiltersDialogProps) {
  const { dict, locale } = useTranslation();
  const labels = dict.browse.filters;
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<BrowseFilters>(state.filters);
  const draftState = useMemo(() => ({ sort: state.sort, filters: draft }), [state.sort, draft]);
  const { count, isUnavailable } = useBrowseCount(category.slug, draftState, isOpen);
  const active = activeFilterCount(state.filters);

  const open = () => {
    setDraft(state.filters);
    setIsOpen(true);
  };

  const apply = () => {
    setIsOpen(false);
    onApply(draft);
  };

  const applyLabel = () => {
    if (isUnavailable) return labels.showUncounted;
    if (count === undefined) return labels.counting;
    if (count === 0) return labels.nothingFound;
    return interpolate(labels.show, { result: countLabel(dict, locale, category.type, count) });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onPress={open}
        aria-label={active > 0 ? interpolate(labels.openActive, { count: active }) : labels.open}
        className="min-h-10 shrink-0 gap-1.5 rounded-full px-3.5"
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        {labels.open}
        {active > 0 ? (
          <Chip aria-hidden size="sm" color="accent" variant="primary" className="tabular-nums">
            {active}
          </Chip>
        ) : null}
      </Button>
      <ResponsiveDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={labels.title}
        footer={
          <div className="flex w-full gap-2">
            <Button
              variant="secondary"
              onPress={() => setDraft(NO_FILTERS)}
              isDisabled={activeFilterCount(draft) === 0}
            >
              {labels.reset}
            </Button>
            <Button variant="primary" className="flex-1" onPress={apply} isDisabled={count === 0}>
              {applyLabel()}
            </Button>
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

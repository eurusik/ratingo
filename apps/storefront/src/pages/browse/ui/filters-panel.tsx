'use client';

import { Button } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import type { BrowseCategory } from '../model/browse-category';
import { NO_FILTERS, activeFilterCount, type BrowseFilters } from '../model/browse-state';
import type { YearPreset } from '../model/year-presets';
import { FilterFields } from './filter-fields';

interface FiltersPanelProps {
  category: BrowseCategory;
  filters: BrowseFilters;
  yearPresets: readonly YearPreset[];
  onChange: (next: BrowseFilters) => void;
}

export function FiltersPanel({ category, filters, yearPresets, onChange }: FiltersPanelProps) {
  const { dict } = useTranslation();

  return (
    <aside
      aria-label={dict.browse.filters.title}
      className="sticky top-36 hidden max-h-[calc(100dvh-10rem)] flex-col gap-5 overflow-y-auto overscroll-contain rounded-3xl bg-surface p-5 lg:flex"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">{dict.browse.filters.title}</h2>
        <Button
          variant="ghost"
          size="sm"
          isDisabled={activeFilterCount(filters) === 0}
          onPress={() => onChange(NO_FILTERS)}
        >
          {dict.browse.filters.reset}
        </Button>
      </div>
      <FilterFields
        type={category.type}
        filters={filters}
        yearPresets={yearPresets}
        onChange={onChange}
      />
    </aside>
  );
}

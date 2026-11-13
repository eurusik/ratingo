'use client';

import { Tag, TagGroup, type Key } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { BrowseFilters } from '../model/browse-state';
import { removalLabel } from '../model/filter-labels';
import { filterRemovals } from '../model/filter-removals';
import type { YearPreset } from '../model/year-presets';

interface ActiveFiltersProps {
  filters: BrowseFilters;
  yearPresets: readonly YearPreset[];
  onChange: (next: BrowseFilters) => void;
}

export function ActiveFilters({ filters, yearPresets, onChange }: ActiveFiltersProps) {
  const { dict } = useTranslation();
  const removals = filterRemovals(filters);
  if (removals.length === 0) return null;

  const remove = (keys: Set<Key>) => {
    const removal = removals.find((candidate) => keys.has(candidate.id));
    if (removal) onChange(removal.next);
  };

  return (
    <TagGroup aria-label={dict.browse.filters.active} onRemove={remove} size="sm">
      <TagGroup.List className="flex flex-wrap gap-1.5">
        {removals.map((removal) => {
          const label = removalLabel(dict, yearPresets, filters, removal);
          return (
            <Tag
              key={removal.id}
              id={removal.id}
              textValue={label}
              className="min-h-8 bg-accent-soft text-accent-soft-foreground"
            >
              {label}
              <Tag.RemoveButton
                aria-label={interpolate(dict.browse.filters.remove, { label })}
              />
            </Tag>
          );
        })}
      </TagGroup.List>
    </TagGroup>
  );
}

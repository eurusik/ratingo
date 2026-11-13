'use client';

import { Tag, TagGroup, type Key } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { removalLabel } from '../model/browse-labels';
import type { BrowseFilters } from '../model/browse-state';
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
    <TagGroup aria-label={dict.browse.filters.active} onRemove={remove}>
      <TagGroup.List className="flex flex-wrap gap-1.5">
        {removals.map((removal) => {
          const label = removalLabel(dict, yearPresets, removal);
          return (
            <Tag
              key={removal.id}
              id={removal.id}
              textValue={label}
              className="min-h-9 gap-0.5 bg-accent-soft ps-3.5 pe-0.5 text-accent-soft-foreground md:min-h-8"
            >
              {label}
              <Tag.RemoveButton
                aria-label={interpolate(dict.browse.filters.remove, { label })}
                className="size-8 bg-transparent text-accent-soft-foreground [&_svg]:size-3.5"
              />
            </Tag>
          );
        })}
      </TagGroup.List>
    </TagGroup>
  );
}

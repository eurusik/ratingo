'use client';

import { useTranslation } from '@/shared/i18n';
import { FilterCountIndicator } from '@/shared/components/filter-count-indicator';

interface SavedFilterIndicatorProps {
  mediaType: 'all' | 'movie' | 'show';
  filteredTotal: number;
  totalAcrossTypes: number;
  onReset: () => void;
}

/**
 * Thin saved-namespace wrapper around FilterCountIndicator that resolves
 * dictionary strings, plural forms, and labels from `dict.saved.filter`.
 * Keeps i18n coupling out of the shared component and the consuming list.
 */
export function SavedFilterIndicator(props: SavedFilterIndicatorProps) {
  const { dict, locale } = useTranslation();
  const filter = dict.saved.filter;
  return (
    <FilterCountIndicator
      {...props}
      template={filter.showingCount}
      itemForms={filter.items}
      resetLabel={filter.showAll}
      locale={locale}
    />
  );
}

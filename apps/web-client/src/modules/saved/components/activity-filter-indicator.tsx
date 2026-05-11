'use client';

import { useTranslation } from '@/shared/i18n';
import { FilterCountIndicator } from '@/shared/components/filter-count-indicator';

interface ActivityFilterIndicatorProps {
  mediaType: 'all' | 'movie' | 'show';
  filteredTotal: number;
  totalAcrossTypes: number;
  onReset: () => void;
}

/**
 * Thin activity-namespace wrapper around FilterCountIndicator that resolves
 * dictionary strings, plural forms, and labels from `dict.activity.filter`.
 */
export function ActivityFilterIndicator(props: ActivityFilterIndicatorProps) {
  const { dict, locale } = useTranslation();
  const filter = dict.activity.filter;
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

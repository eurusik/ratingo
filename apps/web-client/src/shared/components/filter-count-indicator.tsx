'use client';

import { Filter } from 'lucide-react';
import { pluralize } from '@/shared/utils';

interface PluralForms {
  one: string;
  few: string;
  many: string;
}

interface FilterCountIndicatorProps {
  mediaType: 'all' | 'movie' | 'show';
  filteredTotal: number;
  totalAcrossTypes: number;
  template: string;
  itemForms: { movie: PluralForms; show: PluralForms };
  resetLabel: string;
  onReset: () => void;
  locale?: string;
}

/**
 * Subtle one-line filter-status indicator: filter icon + hidden count + reset link.
 * Renders only when a media-type filter is active and items are hidden behind it,
 * so users see exactly *what* is hidden and how to undo it without occupying the
 * visual weight of a full banner.
 */
export function FilterCountIndicator({
  mediaType,
  filteredTotal,
  totalAcrossTypes,
  template,
  itemForms,
  resetLabel,
  onReset,
  locale = 'uk',
}: FilterCountIndicatorProps) {
  if (mediaType === 'all' || totalAcrossTypes <= filteredTotal) return null;

  const hidden = totalAcrossTypes - filteredTotal;
  const otherType = mediaType === 'movie' ? 'show' : 'movie';
  const hiddenItem = pluralize(hidden, itemForms[otherType], locale);
  const message = template
    .replace('{hidden}', String(hidden))
    .replace('{hiddenItem}', hiddenItem);

  return (
    <p
      className="text-xs sm:text-sm text-cinema-text-muted flex items-center gap-1.5 flex-wrap"
      role="status"
      aria-live="polite"
    >
      <Filter className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
      <span aria-hidden="true" className="opacity-60">·</span>
      <button
        type="button"
        onClick={onReset}
        className="text-cinema-focus underline underline-offset-2 hover:no-underline focus-visible:no-underline focus-visible:outline-none"
      >
        {resetLabel}
      </button>
    </p>
  );
}

'use client';

import { Button } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { NO_FILTERS, activeFilterCount, type BrowseFilters } from '../model/browse-state';

interface ResetFiltersButtonProps {
  filters: BrowseFilters;
  variant: 'ghost' | 'secondary';
  onReset: (next: BrowseFilters) => void;
}

export function ResetFiltersButton({ filters, variant, onReset }: ResetFiltersButtonProps) {
  const { dict } = useTranslation();

  return (
    <Button
      variant={variant}
      size={variant === 'ghost' ? 'sm' : 'md'}
      isDisabled={activeFilterCount(filters) === 0}
      onPress={() => onReset(NO_FILTERS)}
    >
      {dict.browse.filters.reset}
    </Button>
  );
}

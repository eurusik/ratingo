'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import type { Route } from 'next';
import { Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui';
import { CATALOG_SORT_OPTIONS, DEFAULT_CATALOG_SORT, type CatalogSort } from '../config';

interface BrowseFiltersProps {
  sortOptions?: readonly CatalogSort[];
  labels: {
    sort: string;
    sortOptions: Record<CatalogSort, string>;
    sortTooltips?: Record<CatalogSort, string>;
  };
}

export function BrowseFilters({ sortOptions = CATALOG_SORT_OPTIONS, labels }: BrowseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawSort = searchParams.get('sort');
  const fallbackSort = (sortOptions as readonly string[]).includes(DEFAULT_CATALOG_SORT)
    ? DEFAULT_CATALOG_SORT
    : sortOptions[0];
  const currentSort =
    rawSort && (sortOptions as readonly string[]).includes(rawSort)
      ? (rawSort as CatalogSort)
      : fallbackSort;

  const updateParams = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      params.delete('page');

      const query = params.toString();
      const url = (query ? `${pathname}?${query}` : pathname) as Route;
      router.push(url);
    },
    [router, pathname, searchParams],
  );

  const handleSortChange = (value: string) => {
    updateParams('sort', value === DEFAULT_CATALOG_SORT ? null : value);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[160px] bg-cinema-card border-cinema-borderSoft cursor-pointer">
          <SelectValue placeholder={labels.sort} />
        </SelectTrigger>
        <SelectContent className="bg-cinema-card border-cinema-borderSoft">
          {sortOptions.map((option) => (
            <SelectItem key={option} value={option} className="cursor-pointer">
              {labels.sortOptions[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {labels.sortTooltips && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="p-1.5 text-cinema-text-muted hover:text-cinema-text-secondary transition-colors"
                aria-label="Інформація про сортування"
              >
                <Info className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-[280px] bg-cinema-elevated border-cinema-border text-cinema-text-primary"
            >
              <p className="text-sm">{labels.sortTooltips[currentSort]}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

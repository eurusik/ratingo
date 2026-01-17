'use client';

/**
 * Browse page filters component.
 * Provides sort filtering for catalog pages.
 */

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

export type CatalogSort = 'trending' | 'popularity' | 'ratingo' | 'releaseDate';

interface BrowseFiltersProps {
  /** i18n labels */
  labels: {
    sort: string;
    sortOptions: {
      trending: string;
      popularity: string;
      ratingo: string;
      releaseDate: string;
    };
    sortTooltips?: {
      trending: string;
      popularity: string;
      ratingo: string;
      releaseDate: string;
    };
  };
}

const SORT_OPTIONS: CatalogSort[] = ['trending', 'popularity', 'ratingo', 'releaseDate'];

/**
 * Filters for browse pages.
 * Updates URL search params on change.
 */
export function BrowseFilters({ labels }: BrowseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = (searchParams.get('sort') as CatalogSort) || 'trending';

  const updateParams = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      // Reset to page 1 when filters change
      params.delete('page');

      const query = params.toString();
      const url = (query ? `${pathname}?${query}` : pathname) as Route;
      router.push(url);
    },
    [router, pathname, searchParams],
  );

  const handleSortChange = (value: string) => {
    updateParams('sort', value === 'trending' ? null : value);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Sort */}
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[160px] bg-cinema-card border-zinc-800">
          <SelectValue placeholder={labels.sort} />
        </SelectTrigger>
        <SelectContent className="bg-cinema-card border-zinc-800">
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {labels.sortOptions[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tooltip with info about current sort */}
      {labels.sortTooltips && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Інформація про сортування"
              >
                <Info className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-[280px] bg-cinema-elevated border-zinc-700 text-zinc-200"
            >
              <p className="text-sm">{labels.sortTooltips[currentSort]}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

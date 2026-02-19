'use client';

import { Loader2 } from 'lucide-react';

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
} from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { MediaType } from '@/core/api/catalog.client';
import type { useSearch } from './use-search';
import { SearchResultItem } from './search-result-item';

const CMDK_CLASSES =
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5';

interface SearchContentProps {
  search: ReturnType<typeof useSearch>;
  listClassName?: string;
}

/**
 * Shared search content used by both desktop Dialog and mobile Drawer.
 * Wraps cmdk Command with input, loading, results, and empty states.
 */
export function SearchContent({ search, listClassName }: SearchContentProps) {
  const { dict } = useTranslation();
  const {
    query,
    setQuery,
    debouncedQuery,
    data,
    isLoading,
    hasResults,
    handleSelect,
    handleImport,
    importingTmdbId,
  } = search;

  return (
    <Command className={CMDK_CLASSES}>
      <CommandInput
        placeholder={dict.search.placeholder}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className={listClassName}>
        {/* Loading */}
        {isLoading && debouncedQuery.length >= 2 && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-cinema-text-muted" />
          </div>
        )}

        {/* No results */}
        {!isLoading && debouncedQuery.length >= 2 && !hasResults && (
          <CommandEmpty>{dict.search.noResults}</CommandEmpty>
        )}

        {/* Hint */}
        {debouncedQuery.length < 2 && (
          <div className="py-6 text-center text-sm text-cinema-text-muted">
            {dict.search.hint}
          </div>
        )}

        {/* Local results */}
        {data?.local && data.local.length > 0 && (
          <CommandGroup heading={dict.search.inCatalog}>
            {data.local.map((item) => (
              <SearchResultItem
                key={`local-${item.tmdbId}`}
                tmdbId={item.tmdbId}
                title={item.title}
                type={item.type}
                year={item.year}
                rating={item.rating}
                posterUrl={item.poster?.small}
                slug={item.slug}
                isLocal
                onSelect={() => handleSelect(item.slug!, item.type as MediaType)}
              />
            ))}
          </CommandGroup>
        )}

        {/* TMDB results */}
        {data?.tmdb && data.tmdb.length > 0 && (
          <>
            {data?.local && data.local.length > 0 && <CommandSeparator />}
            <CommandGroup heading={dict.search.fromTmdb}>
              {data.tmdb.slice(0, 5).map((item) => (
                <SearchResultItem
                  key={`tmdb-${item.tmdbId}`}
                  tmdbId={item.tmdbId}
                  title={item.title}
                  type={item.type}
                  year={item.year}
                  posterUrl={item.poster?.small}
                  isLocal={false}
                  isImporting={importingTmdbId === item.tmdbId}
                  notImportedLabel={dict.search.notImported}
                  onSelect={() =>
                    handleImport(
                      item.tmdbId,
                      item.type as MediaType,
                      item.title,
                      item.poster?.small,
                      item.year ?? undefined,
                    )
                  }
                />
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}

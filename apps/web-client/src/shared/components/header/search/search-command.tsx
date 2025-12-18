'use client';

import { Search, Loader2 } from 'lucide-react';

import { Button } from '@/shared/ui';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
} from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { MediaType } from '@/core/api/catalog';
import { useSearch } from './use-search';
import { SearchResultItem } from './search-result-item';

/**
 * Search command dialog with keyboard shortcut (Cmd+K).
 * Displays local catalog results and TMDB results for import.
 */
export function SearchCommand() {
  const { dict } = useTranslation();
  const {
    open,
    setOpen,
    query,
    setQuery,
    debouncedQuery,
    data,
    isLoading,
    hasResults,
    handleSelect,
    handleImport,
    importingTmdbId,
  } = useSearch();

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{dict.search.placeholder}</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-400">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={dict.search.placeholder}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {/* Loading */}
          {isLoading && debouncedQuery.length >= 2 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          )}

          {/* No results */}
          {!isLoading && debouncedQuery.length >= 2 && !hasResults && (
            <CommandEmpty>{dict.search.noResults}</CommandEmpty>
          )}

          {/* Hint */}
          {debouncedQuery.length < 2 && (
            <div className="py-6 text-center text-sm text-zinc-500">
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
                    onSelect={() => handleImport(item.tmdbId, item.type as MediaType, item.title, item.poster?.small, item.year ?? undefined)}
                  />
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

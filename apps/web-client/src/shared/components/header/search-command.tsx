'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Film, Tv, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';

import { Button } from '@/shared/ui';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/shared/ui';
import { catalogApi } from '@/core/api/catalog';
import { queryKeys } from '@/core/query/keys';
import { useTranslation } from '@/shared/i18n';

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  const router = useRouter();
  const { dict } = useTranslation();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search query
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.search.results(debouncedQuery),
    queryFn: () => catalogApi.search({ query: debouncedQuery }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleSelect = useCallback(
    (slug: string, type: 'movie' | 'show') => {
      setOpen(false);
      setQuery('');
      router.push(type === 'movie' ? `/movies/${slug}` : `/shows/${slug}`);
    },
    [router]
  );

  const hasResults = (data?.local?.length ?? 0) > 0 || (data?.tmdb?.length ?? 0) > 0;

  return (
    <>
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

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={dict.search.placeholder}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && debouncedQuery.length >= 2 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          )}

          {!isLoading && debouncedQuery.length >= 2 && !hasResults && (
            <CommandEmpty>{dict.search.noResults}</CommandEmpty>
          )}

          {debouncedQuery.length < 2 && (
            <div className="py-6 text-center text-sm text-zinc-500">
              {dict.search.hint}
            </div>
          )}

          {/* Local results (from our DB) */}
          {data?.local && data.local.length > 0 && (
            <CommandGroup heading={dict.search.inCatalog}>
              {data.local.map((item) => (
                <CommandItem
                  key={`local-${item.tmdbId}`}
                  value={`${item.title} ${item.year ?? ''}`}
                  onSelect={() => handleSelect(item.slug!, item.type)}
                  className="gap-3 py-2 cursor-pointer"
                >
                  {item.poster?.small ? (
                    <Image
                      src={item.poster.small}
                      alt={item.title}
                      width={32}
                      height={48}
                      className="rounded object-cover"
                    />
                  ) : (
                    <div className="w-8 h-12 bg-zinc-800 rounded flex items-center justify-center">
                      {item.type === 'movie' ? (
                        <Film className="h-4 w-4 text-zinc-600" />
                      ) : (
                        <Tv className="h-4 w-4 text-zinc-600" />
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                      {item.type === 'movie' ? (
                        <Film className="h-3 w-3" />
                      ) : (
                        <Tv className="h-3 w-3" />
                      )}
                      {item.year && <span>{item.year}</span>}
                      {item.rating > 0 && (
                        <>
                          <span>•</span>
                          <span>★ {item.rating.toFixed(1)}</span>
                        </>
                      )}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* TMDB results (not yet imported) */}
          {data?.tmdb && data.tmdb.length > 0 && (
            <>
              {data?.local && data.local.length > 0 && <CommandSeparator />}
              <CommandGroup heading={dict.search.fromTmdb}>
                {data.tmdb.slice(0, 5).map((item) => (
                  <CommandItem
                    key={`tmdb-${item.tmdbId}`}
                    value={`${item.title} ${item.year ?? ''} tmdb`}
                    disabled
                    className="gap-3 py-2 opacity-60"
                  >
                    {item.poster?.small ? (
                      <Image
                        src={item.poster.small}
                        alt={item.title}
                        width={32}
                        height={48}
                        className="rounded object-cover"
                      />
                    ) : (
                      <div className="w-8 h-12 bg-zinc-800 rounded flex items-center justify-center">
                        {item.type === 'movie' ? (
                          <Film className="h-4 w-4 text-zinc-600" />
                        ) : (
                          <Tv className="h-4 w-4 text-zinc-600" />
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="truncate">{item.title}</span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                        {item.type === 'movie' ? (
                          <Film className="h-3 w-3" />
                        ) : (
                          <Tv className="h-3 w-3" />
                        )}
                        {item.year && <span>{item.year}</span>}
                        <span>•</span>
                        <span className="text-zinc-600">{dict.search.notImported}</span>
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

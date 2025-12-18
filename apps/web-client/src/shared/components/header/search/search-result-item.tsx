'use client';

import Image from 'next/image';
import { Film, Tv, Loader2, Download } from 'lucide-react';

import { CommandItem } from '@/shared/ui';

interface SearchResultItemProps {
  tmdbId: number;
  title: string;
  type: 'movie' | 'show';
  year?: number | null;
  rating?: number;
  posterUrl?: string | null;
  slug?: string;
  isLocal: boolean;
  isImporting?: boolean;
  notImportedLabel?: string;
  onSelect: () => void;
}

/**
 * Single search result item (local or TMDB).
 */
export function SearchResultItem({
  tmdbId,
  title,
  type,
  year,
  rating,
  posterUrl,
  isLocal,
  isImporting,
  notImportedLabel,
  onSelect,
}: SearchResultItemProps) {
  const TypeIcon = type === 'movie' ? Film : Tv;

  return (
    <CommandItem
      key={`${isLocal ? 'local' : 'tmdb'}-${tmdbId}`}
      value={`${title} ${year ?? ''} ${isLocal ? '' : 'tmdb'}`}
      onSelect={onSelect}
      disabled={isImporting}
      className="gap-3 py-2 cursor-pointer"
    >
      {/* Poster */}
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={title}
          width={32}
          height={48}
          className="rounded object-cover"
        />
      ) : (
        <div className="w-8 h-12 bg-zinc-800 rounded flex items-center justify-center">
          <TypeIcon className="h-4 w-4 text-zinc-600" />
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className={`truncate ${isLocal ? 'font-medium' : ''}`}>{title}</span>
        <span className="text-xs text-zinc-500 flex items-center gap-1.5">
          <TypeIcon className="h-3 w-3" />
          {year && <span>{year}</span>}
          {isLocal && rating && rating > 0 && (
            <>
              <span>•</span>
              <span>★ {rating.toFixed(1)}</span>
            </>
          )}
          {!isLocal && notImportedLabel && (
            <>
              <span>•</span>
              <span className="text-amber-500">{notImportedLabel}</span>
            </>
          )}
        </span>
      </div>

      {/* Import indicator */}
      {!isLocal && (
        isImporting ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400 shrink-0" />
        ) : (
          <Download className="h-4 w-4 text-zinc-500 shrink-0" />
        )
      )}
    </CommandItem>
  );
}

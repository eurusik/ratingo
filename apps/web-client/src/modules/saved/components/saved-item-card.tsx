/**
 * Card component for saved items in the library.
 * Simplified version of MediaCard for saved lists.
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { Trash2, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/shared/utils';
import { Button } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

interface SavedItemCardProps {
  id: string;
  mediaItemId: string;
  title: string;
  type: 'movie' | 'show';
  slug: string;
  posterUrl: string | null;
  releaseDate?: string | null;
  reasonKey?: string | null;
  onRemove?: () => void;
  onMove?: () => void;
  moveLabel?: string;
  isRemoving?: boolean;
}

export function SavedItemCard({
  title,
  type,
  slug,
  posterUrl,
  releaseDate,
  reasonKey,
  onRemove,
  onMove,
  moveLabel,
  isRemoving,
}: SavedItemCardProps) {
  const { dict } = useTranslation();
  const href = type === 'movie' ? `/movie/${slug}` : `/show/${slug}`;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  
  const reasonLabel = reasonKey && dict.saved.reason[reasonKey as keyof typeof dict.saved.reason];
  const typeLabel = type === 'movie' ? dict.mediaType.movie : dict.mediaType.show;

  return (
    <div className="group relative flex gap-3 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
      {/* Poster */}
      <Link href={href as Route} className="shrink-0">
        <div className="relative w-16 h-24 rounded-md overflow-hidden bg-zinc-800">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
              —
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <Link href={href as Route} className="block">
            <h3 className="font-medium text-zinc-100 truncate hover:text-white transition-colors">
              {title}
            </h3>
          </Link>
          <p className="text-sm text-zinc-500">
            {typeLabel}
            {year && ` • ${year}`}
          </p>
          {reasonLabel && (
            <p className="text-xs text-zinc-600 mt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500/70" />
              <span>{dict.saved.reason.label}: {reasonLabel}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          {onMove && moveLabel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMove}
              className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100"
            >
              <ArrowRight className="w-3 h-3 mr-1" />
              {moveLabel}
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={isRemoving}
              className={cn(
                "h-7 px-2 text-xs",
                "text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
              )}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

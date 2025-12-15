/**
 * Compact CTA row: Save to watchlist.
 */

'use client';

import { Bookmark, ArrowRight } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { getDictionary } from '@/shared/i18n';

export interface DetailsCtaRowProps {
  isSaved?: boolean;
  continuePoint?: { season: number; episode: number } | null;
  hasNewEpisodes?: boolean;
  onSave?: () => void;
  onContinue?: () => void;
  dict: ReturnType<typeof getDictionary>;
}

export function DetailsCtaRow({
  isSaved = false,
  continuePoint,
  hasNewEpisodes = false,
  onSave,
  onContinue,
  dict,
}: DetailsCtaRowProps) {

  return (
    <section>
      {/* Primary CTA: Save or Continue - compact inline style */}
      {continuePoint ? (
        <button
          onClick={onContinue}
          className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 transition-all"
        >
          <ArrowRight className="w-4 h-4 text-green-400 group-hover:translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium text-zinc-200">
            {dict.details.continue} S{continuePoint.season}E{continuePoint.episode}
          </span>
        </button>
      ) : (
        <button
          onClick={onSave}
          className={cn(
            'group flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all',
            isSaved
              ? 'border-zinc-700 bg-zinc-800/50'
              : 'border-zinc-700/50 hover:border-zinc-600 hover:bg-zinc-800/30'
          )}
        >
          <div className="flex items-center gap-3">
            <Bookmark className={cn(
              'w-4 h-4 transition-all',
              isSaved 
                ? 'text-zinc-400 fill-current' 
                : 'text-zinc-500 group-hover:text-zinc-300 group-hover:scale-110'
            )} />
            <div className="flex flex-col items-start">
              <span className={cn(
                'text-sm font-medium',
                isSaved ? 'text-zinc-400' : 'text-zinc-200'
              )}>
                {isSaved ? dict.details.saved : dict.details.save}
              </span>
              {!isSaved && (
                <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  {hasNewEpisodes
                    ? dict.details.cta.saveHint.newEpisodes
                    : dict.details.cta.saveHint.general}
                </span>
              )}
            </div>
          </div>
          {!isSaved && (
            <span className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all">
              →
            </span>
          )}
        </button>
      )}
    </section>
  );
}

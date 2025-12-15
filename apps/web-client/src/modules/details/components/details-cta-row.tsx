/**
 * Primary action button: Save to watchlist.
 *
 * CLIENT COMPONENT - requires onClick handler.
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
      {/* Primary CTA: Save or Continue */}
      {continuePoint ? (
        <button
          onClick={onContinue}
          className={cn(
            'w-full flex flex-col items-center justify-center gap-1 py-3.5 px-4 rounded-xl font-medium transition-all',
            'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'
          )}
        >
          <div className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            <span>
              {dict.details.continue} S{continuePoint.season}E{continuePoint.episode}
            </span>
          </div>
        </button>
      ) : (
        <button
          onClick={onSave}
          className={cn(
            'w-full flex flex-col items-center justify-center gap-1 py-3.5 px-4 rounded-xl font-medium transition-all',
            isSaved
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20'
              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'
          )}
        >
          <div className="flex items-center gap-2">
            <Bookmark className={cn('w-5 h-5', isSaved && 'fill-current')} />
            <span>{isSaved ? dict.details.saved : dict.details.save}</span>
          </div>
          {!isSaved && (
            <span className="text-xs opacity-70">
              {hasNewEpisodes
                ? dict.details.cta.saveHint.newEpisodes
                : dict.details.cta.saveHint.general}
            </span>
          )}
        </button>
      )}
    </section>
  );
}

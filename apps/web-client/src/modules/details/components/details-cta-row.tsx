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
          <span className="text-sm font-medium text-cinema-text-primary">
            {dict.details.continue} S{continuePoint.season}E{continuePoint.episode}
          </span>
        </button>
      ) : (
        <button
          onClick={onSave}
          className={cn(
            'group flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all',
            isSaved
              ? 'border-cinema-border bg-cinema-elevated/50'
              : 'border-cinema-border/50 hover:border-cinema-border hover:bg-cinema-elevated/30',
          )}
        >
          <div className="flex items-center gap-3">
            <Bookmark
              className={cn(
                'w-4 h-4 transition-all',
                isSaved
                  ? 'text-cinema-text-muted fill-current'
                  : 'text-cinema-text-muted group-hover:text-cinema-text-secondary group-hover:scale-110',
              )}
            />
            <div className="flex flex-col items-start">
              <span
                className={cn('text-sm font-medium', isSaved ? 'text-cinema-text-muted' : 'text-cinema-text-primary')}
              >
                {isSaved ? dict.details.saved : dict.details.save}
              </span>
              {!isSaved && (
                <span className="text-xs text-cinema-text-muted group-hover:text-cinema-text-muted transition-colors">
                  {hasNewEpisodes
                    ? dict.details.cta.saveHint.newEpisodes
                    : dict.details.cta.saveHint.general}
                </span>
              )}
            </div>
          </div>
          {!isSaved && (
            <span className="text-cinema-text-disabled group-hover:text-cinema-text-muted group-hover:translate-x-0.5 transition-all">
              →
            </span>
          )}
        </button>
      )}
    </section>
  );
}

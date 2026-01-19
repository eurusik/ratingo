/**
 * Ratingo score badge with label and explanatory subtitle.
 * Shows aggregated quality score with tooltip for curious users.
 */

'use client';

import { Activity, Info } from 'lucide-react';
import { formatRating } from '@/shared/utils/format';
import type { getDictionary } from '@/shared/i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';

interface RatingoScoreProps {
  score: number;
  dict: ReturnType<typeof getDictionary>;
}

export function RatingoScore({ score, dict }: RatingoScoreProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 md:gap-2 bg-cinema-card/60 backdrop-blur-sm px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg w-fit">
        <Activity className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
        <span className="text-xs md:text-sm font-medium text-cinema-text-muted">Ratingo</span>
        <span className="text-lg md:text-2xl font-bold text-white">{formatRating(score)}</span>

        {/* Info icon with tooltip for curious users */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="ml-0.5 text-cinema-text-muted hover:text-cinema-text-muted transition-colors cursor-help"
                onClick={(e) => e.preventDefault()}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm bg-cinema-elevated border border-cinema-border">
              <div className="text-xs leading-relaxed space-y-3">
                <div>
                  <p className="font-semibold text-white">{dict.details.ratingTooltip.title}</p>
                  <p className="text-cinema-text-muted mt-0.5">{dict.details.ratingTooltip.subtitle}</p>
                </div>
                <p className="text-cinema-text-secondary">{dict.details.ratingTooltip.description}</p>
                <div>
                  <p className="font-medium text-white mb-1.5">
                    {dict.details.ratingTooltip.howToRead}
                  </p>
                  <ul className="text-cinema-text-secondary space-y-1.5">
                    <li>• {dict.details.ratingTooltip.exampleHigh}</li>
                    <li>• {dict.details.ratingTooltip.exampleTrending}</li>
                  </ul>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {/* Subtitle explaining what Ratingo is */}
      <span className="text-[10px] md:text-xs text-cinema-text-muted pl-0.5">
        {dict.details.ratingSubtitle}
      </span>
    </div>
  );
}

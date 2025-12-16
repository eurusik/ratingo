/**
 * Popularity badge with tooltip.
 * Shows popularity tier (hot/trending/rising) with explanation.
 */

'use client';

import { Flame, TrendingUp, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PopularityBadgeProps {
  score: number;
  label: string;
  tooltip: string;
}

export function PopularityBadge({ score, label, tooltip }: PopularityBadgeProps) {
  const Icon = score >= 80 ? Flame : score >= 60 ? TrendingUp : Sparkles;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-orange-500/40 text-orange-200 border border-orange-500/50 cursor-help">
            <Icon className="w-4 h-4" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

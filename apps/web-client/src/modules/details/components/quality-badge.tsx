/**
 * Quality badge with tooltip.
 * Shows quality score tier (high/good/decent) with explanation.
 */

'use client';

import { Gem, Award, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface QualityBadgeProps {
  score: number;
  label: string;
  tooltip: string;
}

export function QualityBadge({ score, label, tooltip }: QualityBadgeProps) {
  const Icon = score >= 85 ? Gem : score >= 75 ? Award : CheckCircle2;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-purple-500/40 text-purple-200 border border-purple-500/50 cursor-help">
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

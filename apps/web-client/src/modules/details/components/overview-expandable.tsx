/**
 * Expandable overview section.
 * Shows 2-3 lines preview with "Show more" button.
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/utils';

interface OverviewExpandableProps {
  title: string;
  overview?: string | null;
  showMoreLabel: string;
  showLessLabel: string;
}

/** Approximate character limit for ~2-3 lines on mobile */
const PREVIEW_CHAR_LIMIT = 180;

export function OverviewExpandable({
  title,
  overview,
  showMoreLabel,
  showLessLabel,
}: OverviewExpandableProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!overview) return null;

  const needsTruncation = overview.length > PREVIEW_CHAR_LIMIT;
  const displayText =
    isExpanded || !needsTruncation
      ? overview
      : overview.slice(0, PREVIEW_CHAR_LIMIT).trim() + '...';

  return (
    <section id="overview-section" className="space-y-2 scroll-mt-8">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{title}</h3>

      <div>
        <p
          className={cn(
            'text-base md:text-lg text-zinc-300 leading-relaxed',
            !isExpanded && needsTruncation && 'line-clamp-3',
          )}
        >
          {displayText}
        </p>

        {needsTruncation && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {isExpanded ? (
              <>
                {showLessLabel}
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                {showMoreLabel}
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

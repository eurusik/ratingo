/**
 * Empty state shown when no episodes are scheduled for the selected week.
 *
 * Server component — translations resolved synchronously via getDictionary.
 */

import { CalendarDays } from 'lucide-react';
import { getDictionary, type Locale } from '@/shared/i18n';

interface CalendarEmptyStateProps {
  locale?: Locale;
}

export function CalendarEmptyState({ locale = 'uk' }: CalendarEmptyStateProps) {
  const dict = getDictionary(locale);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      {/* Icon container */}
      <div className="w-20 h-20 rounded-full bg-cinema-elevated/30 border border-cinema-border/50 flex items-center justify-center mb-6">
        <CalendarDays className="w-10 h-10 text-cinema-text-disabled" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-medium text-cinema-text-primary mb-3">
        {dict.calendar.noEpisodesWeek}
      </h3>

      {/* Subtitle */}
      <p className="text-base text-cinema-text-muted max-w-sm leading-relaxed">
        {dict.calendar.tryAnotherWeek}
      </p>
    </div>
  );
}

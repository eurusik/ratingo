/**
 * Empty state shown when no episodes are scheduled for the selected week.
 *
 * Server component — translations resolved synchronously via getDictionary.
 */

import Link from 'next/link';
import type { Route } from 'next';
import { CalendarDays } from 'lucide-react';
import { getDictionary, type Locale } from '@/shared/i18n';

interface CalendarEmptyStateProps {
  locale?: Locale;
  variant?: 'global' | 'personalized' | 'noWatchingShows';
}

export function CalendarEmptyState({ locale = 'uk', variant = 'global' }: CalendarEmptyStateProps) {
  const dict = getDictionary(locale);

  let title: string;
  let subtitle: string;

  if (variant === 'noWatchingShows') {
    title = dict.calendar.noWatchingShows;
    subtitle = dict.calendar.noWatchingShowsHint;
  } else if (variant === 'personalized') {
    title = dict.calendar.noEpisodesPersonalized;
    subtitle = dict.calendar.noEpisodesPersonalizedHint;
  } else {
    title = dict.calendar.noEpisodesWeek;
    subtitle = dict.calendar.tryAnotherWeek;
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      {/* Icon container */}
      <div className="w-20 h-20 rounded-full bg-cinema-elevated/30 border border-cinema-border/50 flex items-center justify-center mb-6">
        <CalendarDays className="w-10 h-10 text-cinema-text-disabled" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-medium text-cinema-text-primary mb-3">
        {title}
      </h3>

      {/* Subtitle */}
      <p className="text-base text-cinema-text-muted max-w-sm leading-relaxed">
        {subtitle}
      </p>

      {/* CTA for no watching shows */}
      {variant === 'noWatchingShows' && (
        <Link
          href={'/browse/shows-trending' as Route}
          className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {dict.calendar.browseCatalog}
        </Link>
      )}
    </div>
  );
}

/**
 * Responsive grid for media cards.
 * Used in browse pages for displaying lists of movies/shows.
 */

import { MediaCardServer, type MediaCardServerProps } from '@/modules/home';
import type { Locale } from '@/shared/i18n';

interface MediaGridProps {
  items: MediaCardServerProps[];
  locale?: Locale;
  className?: string;
}

/**
 * Responsive grid layout for media cards.
 * Adapts from 2 columns on mobile to 6 on desktop.
 */
export function MediaGrid({ items, locale = 'uk', className = '' }: MediaGridProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${className}`}
    >
      {items.map((item) => (
        <MediaCardServer key={item.id} {...item} locale={locale} />
      ))}
    </div>
  );
}

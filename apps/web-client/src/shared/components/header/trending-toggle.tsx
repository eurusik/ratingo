/**
 * Segmented control for switching between trending shows and movies.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';

export function TrendingToggle() {
  const { dict } = useTranslation();
  const pathname = usePathname();

  const isShowsTrending = pathname.startsWith('/browse/shows-trending');
  const isMoviesTrending = pathname.startsWith('/browse/movies-trending');
  const isTrendingSection = isShowsTrending || isMoviesTrending;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'text-sm transition-colors',
          isTrendingSection ? 'text-foreground font-medium' : 'text-muted-foreground',
        )}
      >
        {dict.home.sections.trending}
      </span>
      <div className="flex items-center rounded-full bg-muted/50 p-0.5">
        <Link
          href="/browse/shows-trending"
          className={cn(
            'px-2.5 py-1 text-xs rounded-full transition-all',
            isShowsTrending
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {dict.nav.shows}
        </Link>
        <Link
          href="/browse/movies-trending"
          className={cn(
            'px-2.5 py-1 text-xs rounded-full transition-all',
            isMoviesTrending
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {dict.nav.movies}
        </Link>
      </div>
    </div>
  );
}

/**
 * Segmented control for switching between shows and movies.
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

  return (
    <div className="flex items-center rounded-full bg-muted/50 p-0.5">
      <Link
        href="/browse/shows-trending"
        className={cn(
          'px-3 py-1.5 text-sm rounded-full transition-all',
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
          'px-3 py-1.5 text-sm rounded-full transition-all',
          isMoviesTrending
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {dict.nav.movies}
      </Link>
    </div>
  );
}

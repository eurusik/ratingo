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
    <div className="flex items-center rounded-full bg-cinema-elevated/50 border border-cinema-border p-0.5">
      <Link
        href="/browse/shows-trending"
        className={cn(
          'px-3 py-1.5 text-sm rounded-full transition-all',
          isShowsTrending
            ? 'bg-cinema-card text-cinema-text-primary shadow-sm'
            : 'text-cinema-text-muted hover:text-cinema-text-secondary',
        )}
      >
        {dict.nav.shows}
      </Link>
      <Link
        href="/browse/movies-trending"
        className={cn(
          'px-3 py-1.5 text-sm rounded-full transition-all',
          isMoviesTrending
            ? 'bg-cinema-card text-cinema-text-primary shadow-sm'
            : 'text-cinema-text-muted hover:text-cinema-text-secondary',
        )}
      >
        {dict.nav.movies}
      </Link>
    </div>
  );
}

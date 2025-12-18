/**
 * Global header component with hero/scrolled modes.
 * 
 * Hero mode: transparent, minimal
 * Scrolled mode: solid background, shows contextual breadcrumb if provided
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { useScrollPosition } from '@/shared/hooks';
import { useHeaderContext } from './header-context';
import { UserMenu } from './user-menu';
import { SearchCommand } from './search';

export function Header() {
  const { dict } = useTranslation();
  const isScrolled = useScrollPosition({ threshold: 100 });
  const { breadcrumb, backUrl } = useHeaderContext();

  const hasContext = !!breadcrumb || !!backUrl;
  const showBreadcrumb = isScrolled && hasContext;

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'transition-all duration-300',
        isScrolled
          ? 'bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/80'
          : 'bg-transparent'
      )}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-6">
        {/* Left: Breadcrumb (when scrolled) or Logo */}
        <div className="flex items-center gap-4 min-w-0">
          {showBreadcrumb && backUrl ? (
            <Link
              href={backUrl as Route}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{breadcrumb || dict.details.backToHome}</span>
            </Link>
          ) : (
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="text-xl font-bold text-zinc-100">{dict.meta.siteName}</span>
            </Link>
          )}
        </div>

        {/* Center: Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/browse/trending"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {dict.home.sections.trending}
          </Link>
          <Link
            href="/browse/movies"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {dict.nav.movies}
          </Link>
          <Link
            href="/browse/shows"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {dict.nav.shows}
          </Link>
        </nav>

        {/* Right: Search + Auth */}
        <div className="flex items-center gap-2">
          <SearchCommand />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

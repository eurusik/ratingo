/**
 * Global header component with hero/scrolled modes.
 *
 * Hero mode: transparent
 * Scrolled mode: subtle dark frosted glass (quiet, not showcase)
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
import { NotificationBell } from './notification-bell';

const NAV_LINK_STYLES = 'text-sm text-muted-foreground hover:text-foreground transition-colors';

export function Header() {
  const { dict } = useTranslation();
  const isScrolled = useScrollPosition({ threshold: 50 });
  const { breadcrumb, backUrl } = useHeaderContext();

  const hasContext = !!breadcrumb || !!backUrl;
  const showBreadcrumb = isScrolled && hasContext;

  const navLinks = [
    { href: '/browse/trending', label: dict.home.sections.trending },
    { href: '/browse/movies', label: dict.nav.movies },
    { href: '/browse/shows', label: dict.nav.shows },
  ] as const;

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'transition-all duration-200',
        // Default: transparent
        'bg-transparent',
        // Scrolled: quiet dark frosted glass
        isScrolled && [
          'bg-background/75',
          'backdrop-blur-sm backdrop-saturate-110',
          'border-b border-border/30',
        ],
      )}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-6">
        {/* Left: Breadcrumb (when scrolled) or Logo */}
        <div className="flex items-center gap-4 min-w-0">
          {showBreadcrumb && backUrl ? (
            <Link
              href={backUrl as Route}
              className={cn(NAV_LINK_STYLES, 'flex items-center gap-1.5 shrink-0')}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{breadcrumb || dict.details.backToHome}</span>
            </Link>
          ) : (
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="text-xl font-bold text-foreground">{dict.meta.siteName}</span>
            </Link>
          )}
        </div>

        {/* Center: Nav */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} className={NAV_LINK_STYLES}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Right: Search + Notifications + Auth */}
        <div className="flex items-center gap-2">
          <SearchCommand />
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

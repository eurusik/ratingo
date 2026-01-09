/**
 * Global header with hero/scrolled modes and trending toggle navigation.
 */

'use client';

import Link from 'next/link';
import { type Route } from 'next';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { useScrollPosition } from '@/shared/hooks';
import { useHeaderContext } from './header-context';
import { UserMenu } from './user-menu';
import { SearchCommand } from './search';
import { NotificationBell } from './notification-bell';
import { TrendingToggle } from './trending-toggle';
import { Logo } from './logo';

const NAV_LINK_STYLES = 'text-sm text-muted-foreground hover:text-foreground transition-colors';

export function Header() {
  const { dict } = useTranslation();
  const isScrolled = useScrollPosition({ threshold: 50 });
  const { breadcrumb, backUrl } = useHeaderContext();

  const hasContext = !!breadcrumb || !!backUrl;
  const showBreadcrumb = isScrolled && hasContext;

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'transition-all duration-200',
        // Default: transparent
        'bg-transparent',
        // Scrolled: compact dark frosted glass with subtle border
        isScrolled && [
          'bg-background/80',
          'backdrop-blur-md backdrop-saturate-150',
          'border-b border-border/40',
        ],
      )}
    >
      <div
        className={cn(
          'container mx-auto px-4 flex items-center justify-between gap-6',
          'transition-all duration-200',
          isScrolled ? 'h-14' : 'h-16',
        )}
      >
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
            <Logo />
          )}
        </div>

        {/* Center: Trending toggle (hidden when scrolled on detail pages) */}
        <nav
          aria-label="Main navigation"
          className={cn(
            'hidden md:flex items-center',
            'transition-opacity duration-200',
            isScrolled && hasContext && 'md:hidden',
          )}
        >
          <TrendingToggle />
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

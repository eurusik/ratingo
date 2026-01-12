/**
 * Simplified header for admin pages.
 * Shows trending toggle, search and user menu.
 */

'use client';

import { cn } from '@/shared/utils';
import { UserMenu } from '@/shared/components/header/user-menu';
import { SearchCommand } from '@/shared/components/header/search';
import { NotificationBell } from '@/shared/components/header/notification-bell';
import { TrendingToggle } from '@/shared/components/header/trending-toggle';

export function AdminHeader() {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'bg-background/80',
        'backdrop-blur-md backdrop-saturate-150',
        'border-b border-border/40',
      )}
    >
      <div className="px-6 flex items-center justify-between gap-6 h-14">
        {/* Left: empty space for sidebar alignment */}
        <div className="w-64 hidden md:block" />

        {/* Center: Trending toggle */}
        <nav aria-label="Main navigation" className="flex items-center">
          <TrendingToggle />
        </nav>

        {/* Right: Search + Notifications + User */}
        <div className="flex items-center gap-2">
          <SearchCommand />
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

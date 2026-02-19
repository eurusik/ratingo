/**
 * Fixed bottom navigation dock for mobile screens.
 * Provides 1-tap access to Shows, Movies, Search, Activity, and Saved.
 * Hidden on md+ breakpoints via CSS (no hydration mismatch).
 */

'use client';

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Flame, Film, Search, Play, Bookmark } from 'lucide-react';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { useSearchDialogStore } from '@/shared/stores/search-dialog.store';
import { useTranslation } from '@/shared/i18n';
import { MobileDockItem } from './mobile-dock-item';

export function MobileDock() {
  const pathname = usePathname();
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const openSearch = useSearchDialogStore((s) => s.open);

  /** Returns true if navigation should proceed, false if blocked by auth guard. */
  const requireAuth = useCallback((): boolean => {
    if (!isAuthenticated) {
      openLogin();
      return false;
    }
    return true;
  }, [isAuthenticated, openLogin]);

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-cinema-card/95 backdrop-blur-md backdrop-saturate-150 border-t border-cinema-borderSoft pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-16">
        <MobileDockItem
          icon={Flame}
          label={dict.nav.shows}
          href="/browse/shows-trending"
          isActive={pathname.startsWith('/browse/shows')}
        />
        <MobileDockItem
          icon={Film}
          label={dict.nav.movies}
          href="/browse/movies-trending"
          isActive={pathname.startsWith('/browse/movies')}
        />
        <MobileDockItem
          icon={Search}
          label={dict.nav.search}
          onClick={openSearch}
          isActive={false}
        />
        <MobileDockItem
          icon={Play}
          label={dict.auth.activity}
          href="/activity"
          isActive={pathname.startsWith('/activity')}
          onBeforeNavigate={requireAuth}
        />
        <MobileDockItem
          icon={Bookmark}
          label={dict.auth.saved}
          href="/saved"
          isActive={pathname.startsWith('/saved')}
          onBeforeNavigate={requireAuth}
        />
      </div>
    </nav>
  );
}

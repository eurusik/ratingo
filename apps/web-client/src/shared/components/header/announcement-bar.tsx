/**
 * Dismissable announcement bar for feature updates.
 *
 * Stores dismissed state in localStorage with announcement ID versioning.
 * Respects prefers-reduced-motion for animations.
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from 'react';
import Link from 'next/link';
import { type Route } from 'next';
import { X, Bell } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';

const STORAGE_KEY = 'ratingo:dismissed-announcements-v2';
const ANNOUNCEMENT_BAR_HEIGHT = 40; // px, matches py-1.5 + button height

/**
 * Current active announcement config.
 * Change `id` when updating to show the new announcement to all users.
 * `i18nKey` references the key in locales/uk.json and locales/en.json under "announcement".
 */
const CURRENT_ANNOUNCEMENT = {
  id: 'v4-notifications-2025-02',
  i18nKey: 'notifications' as const,
  href: '/journal/spovishchennya-v-ratingo-bilshe-ne-propusty-novi-seriyi' as Route,
};

// Context to share announcement visibility with Header
interface AnnouncementContextValue {
  isVisible: boolean;
  height: number;
}

const AnnouncementContext = createContext<AnnouncementContextValue>({
  isVisible: false,
  height: 0,
});

export function useAnnouncementBar() {
  return useContext(AnnouncementContext);
}

function getDismissedAnnouncements(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function dismissAnnouncement(id: string): void {
  try {
    const dismissed = getDismissedAnnouncements();
    if (!dismissed.includes(id)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed, id]));
    }
  } catch {
    // Ignore localStorage errors
  }
}

interface AnnouncementBarProviderProps {
  children: React.ReactNode;
}

export function AnnouncementBarProvider({
  children,
}: AnnouncementBarProviderProps) {
  const { dict } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const dismissed = getDismissedAnnouncements();
    setIsVisible(!dismissed.includes(CURRENT_ANNOUNCEMENT.id));
  }, []);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    dismissAnnouncement(CURRENT_ANNOUNCEMENT.id);
  }, []);

  const contextValue = useMemo(
    () => ({
      isVisible: isMounted && isVisible,
      height: isMounted && isVisible ? ANNOUNCEMENT_BAR_HEIGHT : 0,
    }),
    [isMounted, isVisible],
  );

  const { i18nKey, href } = CURRENT_ANNOUNCEMENT;
  const texts = dict.announcement[i18nKey];

  return (
    <AnnouncementContext.Provider value={contextValue}>
      {isMounted && isVisible && (
        <div
          role="banner"
          aria-label={dict.announcement.closeLabel}
          className={cn(
            'fixed top-0 left-0 right-0 z-50',
            'bg-card',
            'border-b border-border',
            'text-foreground',
            'motion-safe:animate-in motion-safe:slide-in-from-top motion-safe:duration-300',
          )}
        >
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center gap-3 py-1.5 text-sm">
              <Bell className="h-4 w-4 shrink-0 text-cinema-400 origin-top motion-safe:animate-bell-ring" aria-hidden="true" />

              <p className="truncate font-medium">{texts.message}</p>

              {href && texts.cta && (
                <Button
                  asChild
                  size="sm"
                  className="h-7 px-3 bg-cinema-500 text-white hover:bg-cinema-400 font-semibold shrink-0"
                >
                  <Link href={href} onClick={handleDismiss}>
                    {texts.cta}
                  </Link>
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                aria-label={dict.announcement.closeLabel}
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      {children}
    </AnnouncementContext.Provider>
  );
}

/** @deprecated Use AnnouncementBarProvider instead */
export function AnnouncementBar() {
  return null;
}

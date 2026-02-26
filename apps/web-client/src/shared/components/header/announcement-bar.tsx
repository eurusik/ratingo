/**
 * Dismissable announcement bar for feature updates and PWA install prompt.
 *
 * Stores dismissed state in localStorage with announcement ID versioning.
 * On mobile, prioritizes PWA install prompt over regular announcements.
 * Respects prefers-reduced-motion for animations.
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  useMemo,
} from 'react';
import Link from 'next/link';
import { type Route } from 'next';
import { X, Bell, Download, Share } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { usePwaInstallStore } from '@/shared/stores/pwa-install.store';

const STORAGE_KEY = 'ratingo:dismissed-announcements-v2';
const ANNOUNCEMENT_BAR_HEIGHT = 40; // px, matches py-1.5 + button height
const PWA_BANNER_ID = 'pwa-install-v1';

/**
 * Current active announcement config.
 * Change `id` when updating to show the new announcement to all users.
 * `i18nKey` references the key in locales/uk.json and locales/en.json under "announcement".
 */
const CURRENT_ANNOUNCEMENT = {
  id: 'v5-social-login-2026-02',
  i18nKey: 'socialLogin' as const,
  href: '/journal/uviyty-v-ratingo-shche-prostishe' as Route,
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

/** Detects iOS Safari including iPadOS 13+ (which reports as Macintosh). */
function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iP(hone|od|ad)/.test(ua)
    || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return isIos && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari standalone
  if ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone) return true;
  // Android/Chrome standalone, fullscreen, or minimal-ui
  if (window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches) return true;
  // Launched from PWA start_url
  if (new URLSearchParams(window.location.search).get('source') === 'pwa') return true;
  return false;
}

/** Detects mobile devices including iPadOS 13+ tablets. */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod/i.test(ua)
    || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
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
  const [showPwaPrompt, setShowPwaPrompt] = useState<'android' | 'ios' | false>(false);

  const bannerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(ANNOUNCEMENT_BAR_HEIGHT);

  const isInstallable = usePwaInstallStore((s) => s.isInstallable);
  const promptInstall = usePwaInstallStore((s) => s.promptInstall);

  // Measure actual banner height (accounts for safe-area-inset-top on PWA)
  useEffect(() => {
    if (!bannerRef.current || !isVisible) return;
    const measure = () => setMeasuredHeight(bannerRef.current?.offsetHeight ?? ANNOUNCEMENT_BAR_HEIGHT);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bannerRef.current);
    return () => ro.disconnect();
  }, [isVisible]);

  // Dismiss PWA banner immediately when app is installed
  useEffect(() => {
    const handleInstalled = () => {
      if (showPwaPrompt) {
        setShowPwaPrompt(false);
        setIsVisible(false);
        dismissAnnouncement(PWA_BANNER_ID);
      }
    };
    window.addEventListener('appinstalled', handleInstalled);
    return () => window.removeEventListener('appinstalled', handleInstalled);
  }, [showPwaPrompt]);

  useEffect(() => {
    setIsMounted(true);
    const dismissed = getDismissedAnnouncements();

    // Never show PWA prompt if already running as installed app
    if (isStandalone()) {
      setShowPwaPrompt(false);
      setIsVisible(!dismissed.includes(CURRENT_ANNOUNCEMENT.id));
      return;
    }

    // Check PWA install eligibility (mobile only, not dismissed)
    if (isMobileDevice() && !dismissed.includes(PWA_BANNER_ID)) {
      if (isInstallable) {
        setShowPwaPrompt('android');
        setIsVisible(true);
        return;
      }
      if (isIosSafari()) {
        setShowPwaPrompt('ios');
        setIsVisible(true);
        return;
      }
    }

    // Fallback to regular announcement
    setShowPwaPrompt(false);
    setIsVisible(!dismissed.includes(CURRENT_ANNOUNCEMENT.id));
  }, [isInstallable]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    if (showPwaPrompt) {
      dismissAnnouncement(PWA_BANNER_ID);
    } else {
      dismissAnnouncement(CURRENT_ANNOUNCEMENT.id);
    }
  }, [showPwaPrompt]);

  const handleInstall = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      setIsVisible(false);
      dismissAnnouncement(PWA_BANNER_ID);
    }
  }, [promptInstall]);

  const contextValue = useMemo(
    () => ({
      isVisible: isMounted && isVisible,
      height: isMounted && isVisible ? measuredHeight : 0,
    }),
    [isMounted, isVisible, measuredHeight],
  );

  const { i18nKey, href } = CURRENT_ANNOUNCEMENT;
  const texts = dict.announcement[i18nKey];

  return (
    <AnnouncementContext.Provider value={contextValue}>
      {isMounted && isVisible && (
        <div
          ref={bannerRef}
          role="banner"
          aria-label={dict.announcement.closeLabel}
          className={cn(
            'fixed top-0 left-0 right-0 z-50',
            'bg-card',
            'border-b border-border',
            'text-foreground',
            'pt-[env(safe-area-inset-top)]',
            'motion-safe:animate-in motion-safe:slide-in-from-top motion-safe:duration-300',
          )}
        >
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center gap-3 py-1.5 text-sm">
              {showPwaPrompt ? (
                <>
                  {showPwaPrompt === 'android' ? (
                    <>
                      <Download className="h-4 w-4 shrink-0 text-cinema-400" aria-hidden="true" />
                      <p className="truncate font-medium">{dict.pwa.installBanner}</p>
                      <Button
                        size="sm"
                        onClick={() => handleInstall().catch(console.error)}
                        className="h-7 px-3 bg-cinema-500 text-white hover:bg-cinema-400 font-semibold shrink-0"
                      >
                        {dict.pwa.installBannerCta}
                      </Button>
                    </>
                  ) : (
                    <p className="truncate font-medium">
                      {dict.pwa.installBannerIos.split('{shareIcon}').map((part, i) =>
                        i === 0 ? part : (
                          <span key={i}>
                            <Share className="inline h-4 w-4 text-cinema-400 -mt-0.5" aria-label="Share" />
                            {part}
                          </span>
                        ),
                      )}
                    </p>
                  )}
                </>
              ) : (
                <>
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
                </>
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

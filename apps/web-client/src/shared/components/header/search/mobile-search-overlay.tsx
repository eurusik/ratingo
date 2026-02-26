'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useSearch } from './use-search';
import { SearchContent } from './search-content';

/**
 * Full-screen mobile search overlay.
 *
 * Renders independently from SearchCommand so it works even when the header
 * search button is hidden on mobile. Uses a plain fixed overlay instead of
 * Vaul Drawer because Vaul's keyboard handling repositions content via JS
 * transforms, causing the input to overlap the iOS status bar in PWA standalone.
 *
 * Opened via shared useSearchDialogStore (same store used by MobileDock).
 */
export function MobileSearchOverlay() {
  const { dict } = useTranslation();
  const isMobile = useIsMobile();
  const search = useSearch();
  const { open, setOpen } = search;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visible = mounted && isMobile && open;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    },
    [setOpen],
  );

  // Escape key to close
  useEffect(() => {
    if (!visible) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, handleKeyDown]);

  // Body scroll lock while overlay is open
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  // Auto-focus the cmdk search input after the overlay appears
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('[cmdk-input]');
      input?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dict.search.placeholder}
      className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="sr-only">{dict.search.hint}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(false)}
          className="ml-auto h-8 w-8 text-muted-foreground"
          aria-label={dict.common.close}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <SearchContent
        search={search}
        listClassName="max-h-none flex-1 overflow-y-auto"
      />
    </div>
  );
}

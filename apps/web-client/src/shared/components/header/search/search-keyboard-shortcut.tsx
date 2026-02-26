'use client';

import { useEffect } from 'react';

import { useSearchDialogStore } from '@/shared/stores/search-dialog.store';

/**
 * Registers the Cmd+K / Ctrl+K keyboard shortcut that toggles the search dialog.
 *
 * Render this component exactly once in the layout so that only a single
 * keydown listener is active at a time, regardless of how many search-related
 * components are mounted (e.g. SearchCommand on desktop + MobileSearchOverlay
 * on mobile both call useSearch, which must NOT register its own listener).
 */
export function SearchKeyboardShortcut() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        useSearchDialogStore.getState().toggle();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return null;
}

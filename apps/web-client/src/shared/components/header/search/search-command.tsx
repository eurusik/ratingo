'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/shared/ui';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import { useTranslation } from '@/shared/i18n';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useSearch } from './use-search';
import { SearchContent } from './search-content';

/**
 * Desktop search command with keyboard shortcut (Cmd+K).
 * Renders trigger button + centered Dialog.
 *
 * On mobile, this only renders the trigger button (hidden via parent CSS).
 * The mobile search overlay is rendered separately by MobileSearchOverlay.
 */
export function SearchCommand() {
  const { dict } = useTranslation();
  const isMobile = useIsMobile();
  const search = useSearch();
  const { open, setOpen } = search;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        size="icon"
        className="h-9 w-9 rounded-full text-cinema-text-muted hover:text-cinema-text-primary hover:bg-cinema-elevated/50 lg:h-auto lg:w-auto lg:rounded-md lg:px-3 lg:py-1.5 lg:gap-2"
      >
        <Search className="h-5 w-5 lg:h-4 lg:w-4" />
        <span className="hidden lg:inline">{dict.search.placeholder}</span>
        <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-cinema-border bg-cinema-elevated px-1.5 font-mono text-[10px] font-medium text-cinema-text-muted">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {mounted && !isMobile && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="overflow-hidden p-0 gap-0">
            <DialogTitle className="sr-only">{dict.search.placeholder}</DialogTitle>
            <DialogDescription className="sr-only">{dict.search.hint}</DialogDescription>
            <SearchContent search={search} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

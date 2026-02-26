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
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-cinema-text-muted hover:text-cinema-text-primary hover:bg-cinema-elevated/50"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{dict.search.placeholder}</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border border-cinema-border bg-cinema-elevated px-1.5 font-mono text-[10px] font-medium text-cinema-text-muted">
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

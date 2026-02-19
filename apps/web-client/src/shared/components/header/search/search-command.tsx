'use client';

import { Search } from 'lucide-react';

import { Button } from '@/shared/ui';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/shared/ui/drawer';
import { useTranslation } from '@/shared/i18n';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useSearch } from './use-search';
import { SearchContent } from './search-content';

/**
 * Search command with keyboard shortcut (Cmd+K).
 * Desktop: centered Dialog. Mobile: bottom sheet Drawer (~70% height).
 */
export function SearchCommand() {
  const { dict } = useTranslation();
  const isMobile = useIsMobile();
  const search = useSearch();
  const { open, setOpen } = search;

  return (
    <>
      {/* Trigger button */}
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

      {/* Desktop: centered Dialog */}
      {!isMobile && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="overflow-hidden p-0 gap-0">
            <DialogTitle className="sr-only">{dict.search.placeholder}</DialogTitle>
            <DialogDescription className="sr-only">{dict.search.hint}</DialogDescription>
            <SearchContent search={search} />
          </DialogContent>
        </Dialog>
      )}

      {/* Mobile: bottom sheet Drawer */}
      {isMobile && (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="h-[70dvh] pb-[env(safe-area-inset-bottom)] [&>div:first-child]:hidden">
            <DrawerTitle className="sr-only">{dict.search.placeholder}</DrawerTitle>
            <DrawerDescription className="sr-only">{dict.search.hint}</DrawerDescription>
            <SearchContent
              search={search}
              listClassName="max-h-none flex-1 overflow-y-auto"
            />
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

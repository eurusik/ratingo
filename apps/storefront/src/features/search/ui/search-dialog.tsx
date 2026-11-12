'use client';

import { useTranslation } from '@/shared/i18n';
import { ResponsiveDialog } from '@/shared/ui';
import { setSearchOpen, useIsSearchOpen } from '../model/search-dialog-state';
import { SearchPanel, type RenderTitleActions } from './search-panel';

export function SearchDialog({ renderActions }: { renderActions?: RenderTitleActions }) {
  const { dict } = useTranslation();
  const isOpen = useIsSearchOpen();

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={setSearchOpen}
      title={dict.search.title}
      size="full"
      isHeaderless
    >
      <SearchPanel renderActions={renderActions} onClose={() => setSearchOpen(false)} />
    </ResponsiveDialog>
  );
}

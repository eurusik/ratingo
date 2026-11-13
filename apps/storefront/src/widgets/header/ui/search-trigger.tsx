'use client';

import { Button } from '@heroui/react';
import { Search } from 'lucide-react';
import { SearchShortcutKbd, openSearch } from '@/features/search';
import { useTranslation } from '@/shared/i18n';

export function SearchTrigger() {
  const { dict } = useTranslation();

  return (
    <Button
      variant="tertiary"
      onPress={openSearch}
      aria-keyshortcuts="Meta+K Control+K"
      className="w-48 justify-start gap-2.5 rounded-full pe-2 font-normal text-muted lg:w-64 xl:w-80"
    >
      <Search aria-hidden className="size-4" />
      <span className="min-w-0 flex-1 truncate text-start">{dict.search.trigger}</span>
      <SearchShortcutKbd />
    </Button>
  );
}

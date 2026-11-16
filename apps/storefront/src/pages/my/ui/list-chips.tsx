'use client';

import Link from 'next/link';
import { buttonVariants } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import {
  MAIN_LIBRARY_LISTS,
  libraryListRoute,
  listCount,
  useLibraryCounts,
  type MainLibraryList,
} from '@/entities/library';
import { useTranslation } from '@/shared/i18n';

export function ListChips({ current }: { current: MainLibraryList }) {
  const { dict } = useTranslation();
  const counts = useLibraryCounts();

  return (
    <nav
      aria-label={dict.my.listsLabel}
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]"
    >
      <ul className="flex gap-2">
        {MAIN_LIBRARY_LISTS.map((list) => {
          const isCurrent = list === current;
          return (
            <li key={list} className="shrink-0">
              <Link
                href={libraryListRoute(list)}
                replace
                scroll={false}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  buttonVariants({ size: 'sm', variant: isCurrent ? 'primary' : 'outline' }),
                  'min-h-tap gap-1.5 rounded-full px-4 no-underline',
                )}
              >
                {dict.my.lists[list]}
                {counts ? (
                  <span className={cn('tabular-nums', isCurrent ? 'opacity-70' : 'text-muted')}>
                    {listCount(counts, list)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BrowseCategorySlug } from './browse-category';
import { browseHref, type BrowseState } from './browse-state';

function scrollBackToTop(): void {
  if (window.scrollY > window.innerHeight) window.scrollTo({ top: 0 });
}

export function useBrowseNavigation(slug: BrowseCategorySlug, state: BrowseState) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shownState, showState] = useOptimistic(state);

  const apply = (next: BrowseState) => {
    scrollBackToTop();
    startTransition(() => {
      showState(next);
      router.replace(browseHref(slug, next), { scroll: false });
    });
  };

  return { shownState, apply, isPending };
}

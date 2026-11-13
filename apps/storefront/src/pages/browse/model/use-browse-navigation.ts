'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BrowseCategorySlug } from './browse-category';
import { browseHref, type BrowseState } from './browse-state';

export interface BrowseLocation {
  slug: BrowseCategorySlug;
  state: BrowseState;
}

function scrollBackToTop(): void {
  if (window.scrollY > window.innerHeight) window.scrollTo({ top: 0 });
}

export function useBrowseNavigation(current: BrowseLocation) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shown, show] = useOptimistic(current);

  const go = (next: BrowseLocation, mode: 'push' | 'replace') => {
    scrollBackToTop();
    startTransition(() => {
      show(next);
      const href = browseHref(next.slug, next.state);
      if (mode === 'push') router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    });
  };

  return {
    shown,
    isPending,
    apply: (state: BrowseState) => go({ slug: shown.slug, state }, 'replace'),
    open: (next: BrowseLocation) => go(next, 'push'),
  };
}

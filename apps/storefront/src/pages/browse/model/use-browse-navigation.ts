'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BrowseCategorySlug } from './browse-category';
import { browseHref, type BrowseState } from './browse-state';

function scrollBackToTop(): void {
  if (window.scrollY > window.innerHeight) window.scrollTo({ top: 0 });
}

export function useBrowseNavigation(slug: BrowseCategorySlug) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const apply = (state: BrowseState) => {
    scrollBackToTop();
    startTransition(() => router.replace(browseHref(slug, state), { scroll: false }));
  };

  return { apply, isPending };
}

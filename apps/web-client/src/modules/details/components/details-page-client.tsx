/**
 * Client boundary for details pages to inject header context.
 * Sets breadcrumb in global header when mounted.
 */

'use client';

import { useEffect, type ReactNode } from 'react';
import { useHeaderContext } from '@/shared/components';

interface DetailsPageClientProps {
  /** Breadcrumb text (e.g., "Фільм", "Серіал • У тренді") */
  breadcrumb?: string;
  /** Back URL (e.g., "/browse/movies", "/browse/shows") */
  backUrl?: string;
  /** Children to render */
  children: ReactNode;
}

export function DetailsPageClient({ breadcrumb, backUrl = '/', children }: DetailsPageClientProps) {
  const { setContext, clearContext } = useHeaderContext();

  useEffect(() => {
    if (breadcrumb) {
      setContext({ breadcrumb, backUrl });
    }
    return () => clearContext();
  }, [breadcrumb, backUrl, setContext, clearContext]);

  return <>{children}</>;
}

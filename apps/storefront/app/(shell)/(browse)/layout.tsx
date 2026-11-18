import type { ReactNode } from 'react';
import { RouteTranslationScope } from '@/app/entrypoint';

export default function BrowseRouteLayout({ children }: { children: ReactNode }) {
  return <RouteTranslationScope namespaces={['browse']}>{children}</RouteTranslationScope>;
}

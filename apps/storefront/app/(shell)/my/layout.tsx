import type { ReactNode } from 'react';
import { RouteTranslationScope } from '@/app/entrypoint';

export default function MyRouteLayout({ children }: { children: ReactNode }) {
  return (
    <RouteTranslationScope namespaces={['details', 'library', 'my', 'pullToRefresh']}>
      {children}
    </RouteTranslationScope>
  );
}

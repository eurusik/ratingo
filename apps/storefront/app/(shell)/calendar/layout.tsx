import type { ReactNode } from 'react';
import { RouteTranslationScope } from '@/app/entrypoint';

export default function CalendarRouteLayout({ children }: { children: ReactNode }) {
  return (
    <RouteTranslationScope namespaces={['calendar', 'details', 'release', 'reminder']}>
      {children}
    </RouteTranslationScope>
  );
}

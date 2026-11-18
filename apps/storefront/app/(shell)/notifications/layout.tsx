import type { ReactNode } from 'react';
import { RouteTranslationScope } from '@/app/entrypoint';

export default function NotificationsRouteLayout({ children }: { children: ReactNode }) {
  return (
    <RouteTranslationScope namespaces={['my', 'pullToRefresh']}>{children}</RouteTranslationScope>
  );
}

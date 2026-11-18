import type { ReactNode } from 'react';
import { RouteTranslationScope } from '@/app/entrypoint';

export default function DetailsRouteLayout({ children }: { children: ReactNode }) {
  return (
    <RouteTranslationScope namespaces={['details', 'library', 'reminder', 'reviews']}>
      {children}
    </RouteTranslationScope>
  );
}

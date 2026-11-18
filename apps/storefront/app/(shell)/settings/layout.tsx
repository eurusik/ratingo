import type { ReactNode } from 'react';
import { RouteTranslationScope } from '@/app/entrypoint';

export default function SettingsRouteLayout({ children }: { children: ReactNode }) {
  return (
    <RouteTranslationScope namespaces={['details', 'my', 'settings']}>
      {children}
    </RouteTranslationScope>
  );
}

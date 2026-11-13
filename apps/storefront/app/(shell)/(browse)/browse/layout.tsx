import type { ReactNode } from 'react';
import { ContentTransition } from '@/shared/ui';

export default function BrowseRouteLayout({ children }: { children: ReactNode }) {
  return <ContentTransition>{children}</ContentTransition>;
}

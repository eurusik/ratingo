import type { ReactNode } from 'react';
import { ContentTransition } from '@/shared/ui';

export default function BrowseLayout({ children }: { children: ReactNode }) {
  return <ContentTransition>{children}</ContentTransition>;
}

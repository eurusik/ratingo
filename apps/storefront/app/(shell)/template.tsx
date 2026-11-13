import type { ReactNode } from 'react';
import { PageTransition } from '@/shared/ui';

export default function ShellTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}

import type { ReactNode } from 'react';
import { ShellLayout } from '@/app/layouts';
import { DEFAULT_LOCALE } from '@/shared/i18n';

export default function ShellRouteLayout({ children }: { children: ReactNode }) {
  return <ShellLayout locale={DEFAULT_LOCALE}>{children}</ShellLayout>;
}

import type { ReactNode } from 'react';
import { getRequestLocale } from '@/app/entrypoint';
import { ShellLayout } from '@/app/layouts';

export default async function ShellRouteLayout({ children }: { children: ReactNode }) {
  return <ShellLayout locale={await getRequestLocale()}>{children}</ShellLayout>;
}

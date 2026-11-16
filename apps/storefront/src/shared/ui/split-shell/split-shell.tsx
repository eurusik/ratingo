import type { ReactNode } from 'react';
import { cn } from '@ratingo/web-core/lib';
import { BackToTop } from '../back-to-top/back-to-top';
import { StatusBarBackdrop } from '../page-header/page-header';

export const SPLIT_SHELL_SIDE_PADDING = 'px-4 md:px-0';

interface SplitShellProps {
  nav: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function SplitShell({ nav, header, children }: SplitShellProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 md:flex-row md:gap-0">
      <StatusBarBackdrop />
      <div className="hidden md:block md:pe-10">
        <div className="md:sticky md:top-16">{nav}</div>
      </div>
      <div className="flex min-w-0 max-w-[900px] flex-1 flex-col gap-3 md:border-s md:border-separator md:ps-10">
        {header}
        <div className={cn('flex flex-1 flex-col gap-3', SPLIT_SHELL_SIDE_PADDING)}>{children}</div>
      </div>
      <BackToTop />
    </div>
  );
}

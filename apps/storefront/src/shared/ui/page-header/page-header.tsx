import type { ReactNode } from 'react';
import { cn } from '@ratingo/web-core/lib';

export const PAGE_TITLE = 'text-[32px] leading-tight font-extrabold tracking-tight md:text-4xl';

export const SECTION_TITLE_DESKTOP = 'md:text-2xl md:tracking-normal';

interface PageHeaderProps {
  title: string;
  titleClassName?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  titleClassName,
  leading,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex min-h-11 items-center gap-2 px-4 pt-[calc(var(--safe-top)+0.25rem)] md:px-0 md:pt-0',
        className,
      )}
    >
      {leading}
      <h1 className={cn('min-w-0 flex-1 truncate', PAGE_TITLE, titleClassName)}>{title}</h1>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

export const STICKY_TOOLBAR =
  'sticky top-(--safe-top) z-20 -mx-4 border-b border-separator bg-background px-4 py-2 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0';

export function StatusBarBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-30 h-(--safe-top) bg-background md:hidden"
    />
  );
}

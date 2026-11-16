import type { ReactNode } from 'react';
import { cn } from '@ratingo/web-core/lib';

export const PAGE_TITLE = 'text-[32px] leading-tight font-extrabold tracking-tight md:text-4xl';

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

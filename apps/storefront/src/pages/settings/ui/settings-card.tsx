import type { ReactNode } from 'react';
import { cn } from '@ratingo/web-core/lib';

export const CARD_LIST =
  'rounded-[20px] bg-surface px-3.5 md:rounded-3xl md:px-6 [&>li+li]:border-t [&>li+li]:border-separator';

export function SettingsGroup({
  title,
  titleId,
  className,
  children,
}: {
  title: string;
  titleId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={titleId} className={cn('flex flex-col gap-2', className)}>
      <h2
        id={titleId}
        className="mx-1 text-[13px] font-bold text-muted md:mx-0 md:text-[17px] md:font-extrabold md:text-foreground"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@ratingo/web-core/lib';

export const STEP_HEADING_ID = 'import-step-heading';

export const STEP_TITLE = 'text-[26px] leading-tight font-extrabold tracking-tight';

export function StepHeading({ className, children }: { className: string; children: ReactNode }) {
  return (
    <h2
      id={STEP_HEADING_ID}
      tabIndex={-1}
      className={cn(
        'scroll-mt-24 rounded-md text-balance outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus',
        className,
      )}
    >
      {children}
    </h2>
  );
}

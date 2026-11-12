import type { ReactNode } from 'react';
import Link from 'next/link';

interface SectionHeaderProps {
  id: string;
  title: string;
  caption?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  trailing?: ReactNode;
}

export function SectionHeader({
  id,
  title,
  caption,
  actionHref,
  actionLabel,
  trailing,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-0.5 px-4 md:px-0">
      <div className="flex min-h-tap items-center justify-between gap-3">
        <h2 id={id} className="text-xl font-extrabold tracking-tight text-balance">
          {title}
        </h2>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex min-h-tap shrink-0 items-center text-sm font-medium text-link no-underline"
          >
            {actionLabel}
          </Link>
        ) : null}
        {trailing}
      </div>
      {caption ? <p className="text-xs text-muted">{caption}</p> : null}
    </div>
  );
}

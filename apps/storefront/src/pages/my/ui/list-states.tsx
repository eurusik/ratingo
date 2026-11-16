'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, Skeleton, buttonVariants } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { useTranslation } from '@/shared/i18n';
import { EMPTY_STATE_ACTION, EmptyState } from '@/shared/ui';
import { ROW_FRAME } from './library-row';

const SKELETON_ROWS = 5;

export function RowsSkeleton({ rows = SKELETON_ROWS }: { rows?: number }) {
  const { dict } = useTranslation();

  return (
    <ul aria-busy aria-label={dict.common.loading} className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <li
          key={index}
          className="flex min-h-[79px] items-center gap-3 py-2 md:min-h-[97px] md:gap-4"
        >
          <Skeleton className={cn('shrink-0 rounded-[10px]', ROW_FRAME)} />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5 rounded-md" />
            <Skeleton className="h-3.5 w-3/5 rounded-md" />
          </span>
          <Skeleton className="size-11 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

export function ListFailure({ onRetry }: { onRetry: () => void }) {
  const { dict } = useTranslation();

  return (
    <EmptyState
      title={dict.my.failed}
      text={dict.my.failedText}
      action={
        <Button variant="secondary" className={EMPTY_STATE_ACTION} onPress={onRetry}>
          {dict.my.retry}
        </Button>
      }
    />
  );
}

interface EmptyListProps {
  title: string;
  text: string;
  action: string;
  href: string;
}

export function EmptyList({ title, text, action, href }: EmptyListProps) {
  return (
    <EmptyState
      title={title}
      text={text}
      action={
        <Link
          href={href}
          className={cn(buttonVariants({ variant: 'primary' }), EMPTY_STATE_ACTION)}
        >
          {action}
        </Link>
      }
    />
  );
}

export function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="flex items-center gap-2 pt-5 pb-1 text-[17px] font-extrabold md:text-lg">
      {children}
    </h3>
  );
}

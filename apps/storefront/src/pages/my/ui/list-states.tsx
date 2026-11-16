'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Skeleton, buttonVariants } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { useTranslation } from '@/shared/i18n';
import type { MainLibraryList } from '@/entities/library';
import {
  EMPTY_STATE_ACTION,
  EmptyState,
  LIST_ROW_FRAME,
  STICKY_TOOLBAR,
  SectionError,
} from '@/shared/ui';

const SKELETON_ROWS = 10;

type RowAction = 'check' | 'pill' | 'score' | 'none';

const ACTION_SKELETON: Record<Exclude<RowAction, 'none'>, string> = {
  check: 'size-11 rounded-full',
  pill: 'size-11 rounded-full md:w-24',
  score: 'h-11 w-18 rounded-full',
};

interface RowsSkeletonProps {
  rows?: number;
  action?: RowAction;
  hasMenu?: boolean;
}

export function RowsSkeleton({
  rows = SKELETON_ROWS,
  action = 'none',
  hasMenu = true,
}: RowsSkeletonProps) {
  return (
    <ul aria-hidden className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <li
          key={index}
          className="flex min-h-[79px] items-center gap-3 py-2 md:min-h-[97px] md:gap-4"
        >
          <Skeleton className={cn('shrink-0 rounded-[10px]', LIST_ROW_FRAME)} />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5 rounded-md" />
            <Skeleton className="h-3.5 w-3/5 rounded-md" />
          </span>
          {action === 'none' ? null : (
            <Skeleton className={cn('shrink-0', ACTION_SKELETON[action])} />
          )}
          {hasMenu ? (
            <span className="flex size-11 shrink-0 items-center justify-center">
              <Skeleton className="h-1.5 w-5 rounded-full" />
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PillsSkeleton({ widths }: { widths: readonly string[] }) {
  return (
    <span className="flex gap-2">
      {widths.map((width) => (
        <Skeleton key={width} className={cn('h-11 shrink-0 rounded-full', width)} />
      ))}
    </span>
  );
}

const SECTION_TITLE_TEXT = 'text-[17px] font-extrabold md:text-lg';

function SectionTitleSkeleton() {
  return (
    <span className={cn('flex pt-5 pb-1', SECTION_TITLE_TEXT)}>
      <Skeleton className="h-lh w-36 rounded-md" />
    </span>
  );
}

const TYPE_FILTER_WIDTHS = ['w-14', 'w-20', 'w-22'] as const;

const WATCHING_FILTER_WIDTHS = ['w-28', 'w-32', 'w-30'] as const;

function SearchSkeleton() {
  return <Skeleton className="h-12 w-full rounded-full" />;
}

function ListSkeletonBody({ list }: { list: MainLibraryList }) {
  if (list === 'plan') {
    return (
      <div className="flex flex-col gap-3">
        <SearchSkeleton />
        <div className="-mx-4 flex items-center gap-2 overflow-hidden px-4 md:mx-0 md:justify-between md:px-0">
          <PillsSkeleton widths={TYPE_FILTER_WIDTHS} />
          <Skeleton className="h-11 w-44 shrink-0 rounded-full" />
        </div>
        <RowsSkeleton action="pill" />
      </div>
    );
  }
  if (list === 'history') {
    return (
      <div className="flex flex-col gap-3">
        <SearchSkeleton />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex h-lh items-center text-sm md:hidden">
            <Skeleton className="h-4 w-36 rounded-md" />
          </span>
          <PillsSkeleton widths={TYPE_FILTER_WIDTHS} />
        </div>
        <div className="flex flex-col">
          <SectionTitleSkeleton />
          <RowsSkeleton action="score" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <SearchSkeleton />
      <div className="-mx-4 overflow-hidden px-4 md:mx-0 md:px-0">
        <PillsSkeleton widths={WATCHING_FILTER_WIDTHS} />
      </div>
      <div className="flex flex-col">
        <SectionTitleSkeleton />
        <RowsSkeleton action="check" />
      </div>
    </div>
  );
}

export function LibraryListSkeleton({ list }: { list: MainLibraryList }) {
  const { dict } = useTranslation();

  return (
    <div role="status" aria-busy className="flex flex-col">
      <span className="sr-only">{dict.common.loading}</span>
      <ListSkeletonBody list={list} />
    </div>
  );
}

export function ChipsSkeleton() {
  return (
    <div className={cn(STICKY_TOOLBAR, 'md:hidden')}>
      <PillsSkeleton widths={['w-28', 'w-44', 'w-32']} />
    </div>
  );
}

interface ListFailureProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function ListFailure({ onRetry, isRetrying }: ListFailureProps) {
  const { dict } = useTranslation();

  return (
    <div className="py-4">
      <SectionError
        title={dict.my.failed}
        onRetry={onRetry}
        isRetrying={isRetrying}
        className="min-h-80"
      />
    </div>
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
    <h3 id={id} className={cn('flex items-center gap-2 pt-5 pb-1', SECTION_TITLE_TEXT)}>
      {children}
    </h3>
  );
}

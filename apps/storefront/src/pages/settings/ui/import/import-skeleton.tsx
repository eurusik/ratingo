'use client';

import { Skeleton } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { CARD_LIST } from '../settings-card';
import { StepProgress } from './step-progress';

const SOURCE_ROWS = 4;
const PHONE_STEPS = 3;
const DESKTOP_STEPS = 2;

function ResumeCardSkeleton() {
  return <Skeleton className="h-[175px] w-full rounded-[20px] md:h-[155px]" />;
}

function PhoneSourceSkeleton({ expectsResume }: { expectsResume: boolean }) {
  return (
    <>
      {expectsResume ? (
        <ResumeCardSkeleton />
      ) : (
        <div className="flex flex-col gap-2">
          <StepProgress current={0} total={PHONE_STEPS} />
          <Skeleton className="h-4 w-36 rounded-md" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-1/3 rounded-md" />
      </div>
      <ul className={CARD_LIST}>
        {Array.from({ length: SOURCE_ROWS }, (_, index) => (
          <li key={index} className="flex min-h-17 items-center gap-3.5 py-2.5">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-3 w-44 rounded-md" />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function DesktopFilesSkeleton({ expectsResume }: { expectsResume: boolean }) {
  return (
    <>
      {expectsResume ? <ResumeCardSkeleton /> : null}
      <StepProgress current={0} total={DESKTOP_STEPS} className="max-w-90" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-6 w-20 rounded-md" />
        <div className="flex gap-2.5">
          {Array.from({ length: SOURCE_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-[70px] flex-1 rounded-[18px]" />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2.5 border-t border-separator pt-4">
        <Skeleton className="h-4 w-80 rounded-md" />
        <span className="flex-1" />
        <Skeleton className="h-11 w-20 rounded-full" />
      </div>
    </>
  );
}

interface ImportSkeletonProps {
  isDesktop: boolean;
  expectsResume?: boolean;
}

export function ImportSkeleton({ isDesktop, expectsResume = false }: ImportSkeletonProps) {
  const { dict } = useTranslation();

  return (
    <div role="status" aria-busy className="flex flex-col gap-5 md:gap-4">
      <span className="sr-only">{dict.common.loading}</span>
      {isDesktop ? (
        <DesktopFilesSkeleton expectsResume={expectsResume} />
      ) : (
        <PhoneSourceSkeleton expectsResume={expectsResume} />
      )}
    </div>
  );
}

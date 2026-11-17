'use client';

import { useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import type { Review } from '@/shared/api';

const ComposeSheet = dynamic(
  () => import('./compose-sheet').then((module) => module.ComposeSheet),
  {
    ssr: false,
  },
);
const ThreadSheet = dynamic(() => import('./thread-sheet').then((module) => module.ThreadSheet), {
  ssr: false,
});
const ReportDialog = dynamic(
  () => import('./report-dialog').then((module) => module.ReportDialog),
  {
    ssr: false,
  },
);

const subscribeToNothing = () => () => {};

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

function useMountedOnceOpened(isOpen: boolean): boolean {
  const [hasOpened, setHasOpened] = useState(isOpen);
  if (isOpen && !hasOpened) setHasOpened(true);
  return hasOpened;
}

interface ReviewDialogsProps {
  isPhone: boolean;
  canCompose: boolean;
  compose: { session: number; isOpen: boolean; editing: Review | null; close: () => void };
  threadReview: Review | null;
  onCloseThread: () => void;
  reportReview: Review | null;
  onCloseReport: () => void;
}

export function ReviewDialogs({
  isPhone,
  canCompose,
  compose,
  threadReview,
  onCloseThread,
  reportReview,
  onCloseReport,
}: ReviewDialogsProps) {
  const isHydrated = useIsHydrated();
  const hasComposed = useMountedOnceOpened(isPhone && compose.isOpen);
  const keepsComposeReady = isHydrated && isPhone && (canCompose || hasComposed);
  const hasOpenedThread = useMountedOnceOpened(isPhone && threadReview !== null);
  const hasReported = useMountedOnceOpened(reportReview !== null);

  return (
    <>
      {keepsComposeReady ? (
        <ComposeSheet
          key={compose.session}
          isOpen={compose.isOpen}
          editing={compose.editing}
          onClose={compose.close}
        />
      ) : null}
      {isPhone && hasOpenedThread ? (
        <ThreadSheet review={threadReview} onClose={onCloseThread} />
      ) : null}
      {hasReported ? <ReportDialog review={reportReview} onClose={onCloseReport} /> : null}
    </>
  );
}

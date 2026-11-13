'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Spinner } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { useMediaQuery } from '@/shared/lib';
import { attachPullDown } from './pull-down';

const STANDALONE_QUERY = '(display-mode: standalone)';

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { dict } = useTranslation();
  const isStandalone = useMediaQuery(STANDALONE_QUERY);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    const indicator = indicatorRef.current;
    if (!isStandalone || !root || !content || !indicator) return;
    return attachPullDown({
      root,
      content,
      indicator,
      onRelease: async () => {
        setIsRefreshing(true);
        try {
          await onRefreshRef.current();
        } finally {
          setIsRefreshing(false);
        }
      },
    });
  }, [isStandalone]);

  return (
    <div ref={rootRef} className="relative">
      <div
        ref={indicatorRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-12 flex h-12 items-center justify-center opacity-0"
      >
        <Spinner size="sm" />
      </div>
      <div ref={contentRef}>{children}</div>
      <span role="status" className="sr-only">
        {isRefreshing ? dict.pullToRefresh.refreshing : ''}
      </span>
    </div>
  );
}

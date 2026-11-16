'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function useRetryTransition(retry: () => void) {
  const [isRetrying, startRetry] = useTransition();
  return { retry: () => startRetry(retry), isRetrying };
}

export function useRefreshRetry() {
  const router = useRouter();
  return useRetryTransition(() => router.refresh());
}

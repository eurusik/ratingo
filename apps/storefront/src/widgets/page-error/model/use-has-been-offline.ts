'use client';

import { useState } from 'react';
import { useIsOffline } from '@/shared/lib';

export function useHasBeenOffline(): boolean {
  const isOffline = useIsOffline();
  const [hasBeenOffline, setHasBeenOffline] = useState(isOffline);
  if (isOffline && !hasBeenOffline) setHasBeenOffline(true);
  return isOffline || hasBeenOffline;
}

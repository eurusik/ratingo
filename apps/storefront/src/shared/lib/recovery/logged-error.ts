'use client';

import { useEffect } from 'react';
import { track } from '../analytics/track';

export function useLoggedError(label: string, error: unknown): void {
  useEffect(() => {
    console.error(label, error);
    track('app_error', { kind: 'render', area: label });
  }, [label, error]);
}

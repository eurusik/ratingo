'use client';

import { useEffect } from 'react';

export function useLoggedError(label: string, error: unknown): void {
  useEffect(() => {
    console.error(label, error);
  }, [label, error]);
}

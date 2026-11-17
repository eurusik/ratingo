'use client';

import { useEffect } from 'react';
import { useLibraryCounts } from '@/entities/library';
import type { LibraryCounts } from '@/shared/api';
import { setUserProperties } from '@/shared/lib';

export function librarySizeBucket(counts: LibraryCounts): string {
  const total = Object.values(counts).reduce(
    (sum, value) => sum + (typeof value === 'number' ? value : 0),
    0,
  );
  if (total === 0) return '0';
  if (total < 3) return '1-2';
  if (total < 10) return '3-9';
  return '10+';
}

export function LibrarySizeReporter() {
  const counts = useLibraryCounts();
  const bucket = counts ? librarySizeBucket(counts) : null;

  useEffect(() => {
    if (bucket) setUserProperties({ library_size: bucket });
  }, [bucket]);

  return null;
}

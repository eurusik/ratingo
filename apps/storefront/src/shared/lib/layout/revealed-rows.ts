'use client';

import { useState } from 'react';

const ROWS_PER_STEP = 20;

export interface RevealedRows<T> {
  shown: T[];
  hasMore: boolean;
  shownCount: number;
  showMore: () => void;
}

export function useRevealedRows<T>(rows: readonly T[], resetKey: string): RevealedRows<T> {
  const [state, setState] = useState({ resetKey, count: ROWS_PER_STEP });
  const count = state.resetKey === resetKey ? state.count : ROWS_PER_STEP;
  if (state.resetKey !== resetKey) setState({ resetKey, count: ROWS_PER_STEP });

  return {
    shown: rows.slice(0, count),
    hasMore: rows.length > count,
    shownCount: count,
    showMore: () => setState({ resetKey, count: count + ROWS_PER_STEP }),
  };
}

'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useDelayedSave(save: (score: number) => void, delayMs: number) {
  const saveRef = useRef(save);
  const pendingScore = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    pendingScore.current = null;
  }, []);

  const flush = useCallback(() => {
    const score = pendingScore.current;
    cancel();
    if (score !== null) saveRef.current(score);
  }, [cancel]);

  useEffect(() => flush, [flush]);

  const schedule = useCallback(
    (score: number) => {
      pendingScore.current = score;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [flush, delayMs],
  );

  return { schedule, cancel };
}

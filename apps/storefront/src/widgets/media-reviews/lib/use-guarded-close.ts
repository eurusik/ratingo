'use client';

import { useState } from 'react';

export function useGuardedClose(isDirty: boolean, close: () => void) {
  const [isAsking, setIsAsking] = useState(false);

  return {
    isAsking,
    request: () => {
      if (isDirty) setIsAsking(true);
      else close();
    },
    keep: () => setIsAsking(false),
    discard: () => {
      setIsAsking(false);
      close();
    },
  };
}

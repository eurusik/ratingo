'use client';

import { useState } from 'react';

export function useHasChanged<T>(value: T): boolean {
  const [initial] = useState(value);
  const [hasChanged, setHasChanged] = useState(false);
  if (!hasChanged && !Object.is(value, initial)) setHasChanged(true);
  return hasChanged || !Object.is(value, initial);
}

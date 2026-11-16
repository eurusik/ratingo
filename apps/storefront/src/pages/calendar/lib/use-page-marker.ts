'use client';

import { useEffect } from 'react';

export function usePageMarker(attribute: string): void {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(attribute, '');
    return () => root.removeAttribute(attribute);
  }, [attribute]);
}

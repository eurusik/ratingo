'use client';

import { useEffect } from 'react';
import { track } from './track';

export function NotFoundReporter() {
  useEffect(() => {
    track('app_error', { kind: 'not_found', area: 'page' });
  }, []);

  return null;
}

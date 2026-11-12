'use client';

import { useEffect } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { takePendingIntent } from '@/shared/auth';
import { useLibrarySave } from './library-save';

export function useReplaySaveAfterSignIn(): void {
  const { isLoading, isAuthenticated } = useAuth();
  const { save } = useLibrarySave();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const intent = takePendingIntent();
    if (intent?.kind === 'save') save({ mediaItemId: intent.mediaItemId, title: intent.title });
  }, [isLoading, isAuthenticated, save]);
}

'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { LIBRARY_QUERY_KEY } from './save-status';

export function useForgetLibraryOnUserChange(): void {
  const queryClient = useQueryClient();
  const userId = useAuth().user?.id ?? null;
  const previousUserId = useRef(userId);

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (previous !== null && previous !== userId) {
      queryClient.removeQueries({ queryKey: LIBRARY_QUERY_KEY });
    }
  }, [queryClient, userId]);
}

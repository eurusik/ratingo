'use client';

import { useCallback, useState } from 'react';
import type { Review } from '@/shared/api';

interface ComposeState {
  session: number;
  isOpen: boolean;
  editing: Review | null;
}

export function useComposeState() {
  const [state, setState] = useState<ComposeState>({ session: 0, isOpen: false, editing: null });

  const open = useCallback(
    (editing?: Review) =>
      setState((current) => ({
        session: current.session + 1,
        isOpen: true,
        editing: editing ?? null,
      })),
    [],
  );
  const close = useCallback(() => setState((current) => ({ ...current, isOpen: false })), []);

  return { ...state, open, close };
}

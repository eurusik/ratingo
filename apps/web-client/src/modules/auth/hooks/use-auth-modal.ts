/**
 * Hook for managing auth modal state.
 * Re-exports the global Zustand store for backward compatibility.
 */

'use client';

import { useAuthModalStore } from '@/core/auth';

export function useAuthModal() {
  return useAuthModalStore();
}

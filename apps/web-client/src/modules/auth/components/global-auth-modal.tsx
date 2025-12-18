/**
 * Global auth modal component.
 * Should be rendered once in the root layout.
 * Uses Zustand store for state management.
 */

'use client';

import { useAuthModalStore } from '@/core/auth';
import { AuthModal } from './auth-modal';

export function GlobalAuthModal() {
  const { isOpen, mode, close } = useAuthModalStore();

  return <AuthModal isOpen={isOpen} onClose={close} initialMode={mode} />;
}

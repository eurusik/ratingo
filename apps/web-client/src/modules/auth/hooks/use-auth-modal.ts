/**
 * Hook for managing auth modal state.
 */

'use client';

import { useState, useCallback } from 'react';

type AuthMode = 'login' | 'register';

interface UseAuthModalReturn {
  isOpen: boolean;
  mode: AuthMode;
  openLogin: () => void;
  openRegister: () => void;
  close: () => void;
}

export function useAuthModal(): UseAuthModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');

  const openLogin = useCallback(() => {
    setMode('login');
    setIsOpen(true);
  }, []);

  const openRegister = useCallback(() => {
    setMode('register');
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return { isOpen, mode, openLogin, openRegister, close };
}

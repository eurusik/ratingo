'use client';

import { useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AuthProvider as SessionAuthProvider } from '@ratingo/web-core/auth';
import { useTranslation } from '@/shared/i18n';
import { configureWebClientApi } from '../api/client';

configureWebClientApi();

export function AuthProvider({ children }: { children: ReactNode }) {
  const { dict } = useTranslation();
  const sessionExpiredMessage = dict.auth.errors.sessionExpired;
  const notifySessionExpired = useCallback(() => {
    toast.error(sessionExpiredMessage);
  }, [sessionExpiredMessage]);

  return <SessionAuthProvider onSessionExpired={notifySessionExpired}>{children}</SessionAuthProvider>;
}

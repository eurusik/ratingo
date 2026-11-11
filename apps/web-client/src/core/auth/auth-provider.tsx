'use client';

import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { AuthProvider as SessionAuthProvider } from '@ratingo/web-core/auth';
import { configureWebClientApi } from '../api/client';

configureWebClientApi();

function notifySessionExpired(): void {
  toast.error('Сесія закінчилась. Увійдіть знову.');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionAuthProvider onSessionExpired={notifySessionExpired}>{children}</SessionAuthProvider>;
}

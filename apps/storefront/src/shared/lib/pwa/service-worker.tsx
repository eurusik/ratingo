'use client';

import type { ReactNode } from 'react';
import { SerwistProvider } from '@serwist/turbopack/react';

const SERVICE_WORKER_URL = '/sw.js';

const REGISTRATION_OPTIONS: RegistrationOptions = { scope: '/', type: 'classic' };

interface ServiceWorkerProviderProps {
  enabled: boolean;
  children: ReactNode;
}

export function ServiceWorkerProvider({ enabled, children }: ServiceWorkerProviderProps) {
  return (
    <SerwistProvider
      swUrl={SERVICE_WORKER_URL}
      disable={!enabled}
      cacheOnNavigation={false}
      reloadOnOnline={false}
      options={REGISTRATION_OPTIONS}
    >
      {children}
    </SerwistProvider>
  );
}

'use client';

import { useEffect } from 'react';
import {
  usePwaInstallStore,
  type BeforeInstallPromptEvent,
} from '@/shared/stores/pwa-install.store';

/**
 * Registers beforeinstallprompt and appinstalled listeners.
 * Use `usePwaInstallStore` to read `isInstallable` and call `promptInstall`.
 */
export function usePwaInstall() {
  const setDeferredPrompt = usePwaInstallStore((s) => s.setDeferredPrompt);

  useEffect(() => {
    // Pick up any event captured by the inline script before React hydrated.
    const early = (window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent }).__pwaPrompt;
    if (early) {
      setDeferredPrompt(early);
      delete (window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent }).__pwaPrompt;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => setDeferredPrompt(null);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [setDeferredPrompt]);
}

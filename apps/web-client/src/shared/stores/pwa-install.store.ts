/**
 * PWA install prompt store.
 * Captures the beforeinstallprompt event so the app can trigger install on demand.
 */

import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  setDeferredPrompt: (evt: BeforeInstallPromptEvent | null) => void;
}

export const usePwaInstallStore = create<PwaInstallState>((set) => ({
  deferredPrompt: null,
  isInstallable: false,
  setDeferredPrompt: (deferredPrompt) =>
    set({ deferredPrompt, isInstallable: deferredPrompt !== null }),
}));

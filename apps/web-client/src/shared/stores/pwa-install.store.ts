/**
 * PWA install prompt store.
 * Captures the beforeinstallprompt event so the app can trigger install on demand.
 */

import { create } from 'zustand';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  setDeferredPrompt: (evt: BeforeInstallPromptEvent | null) => void;
  promptInstall: () => Promise<void>;
}

export const usePwaInstallStore = create<PwaInstallState>((set, get) => ({
  deferredPrompt: null,
  isInstallable: false,
  setDeferredPrompt: (deferredPrompt) =>
    set({ deferredPrompt, isInstallable: deferredPrompt !== null }),
  promptInstall: async () => {
    const { deferredPrompt, setDeferredPrompt } = get();
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  },
}));

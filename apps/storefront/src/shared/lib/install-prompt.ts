'use client';

import { useEffect, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function publish(prompt: BeforeInstallPromptEvent | null): void {
  deferredPrompt = prompt;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const readPrompt = () => deferredPrompt;
const readServerPrompt = () => null;

export function InstallPromptCapture(): null {
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      publish(event as BeforeInstallPromptEvent);
    };
    const forget = () => publish(null);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', forget);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', forget);
    };
  }, []);

  return null;
}

export function useInstallApp(): (() => void) | null {
  const prompt = useSyncExternalStore(subscribe, readPrompt, readServerPrompt);
  if (!prompt) return null;
  return () => {
    publish(null);
    void prompt.prompt();
  };
}

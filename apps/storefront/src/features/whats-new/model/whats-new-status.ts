'use client';

import { useSyncExternalStore } from 'react';
import {
  WEB_CLIENT_STORAGE_KEYS,
  WEB_CLIENT_STORAGE_KEY_PREFIXES,
  WHATS_NEW_STORAGE_KEY,
} from '../config/whats-new';

export type WhatsNewStatus = 'due' | 'seen';

function isWhatsNewStatus(value: string | null): value is WhatsNewStatus {
  return value === 'due' || value === 'seen';
}

function storageKeys(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? '');
}

export function hasWebClientData(storage: Storage): boolean {
  if (WEB_CLIENT_STORAGE_KEYS.some((key) => storage.getItem(key) !== null)) return true;
  return storageKeys(storage).some((key) =>
    WEB_CLIENT_STORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
  );
}

export function settleWhatsNewStatus(storage: Storage): WhatsNewStatus {
  const stored = storage.getItem(WHATS_NEW_STORAGE_KEY);
  if (isWhatsNewStatus(stored)) return stored;

  const status: WhatsNewStatus = hasWebClientData(storage) ? 'due' : 'seen';
  storage.setItem(WHATS_NEW_STORAGE_KEY, status);
  return status;
}

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

let isDismissedWithoutStorage = false;

function readStatus(): WhatsNewStatus {
  if (isDismissedWithoutStorage) return 'seen';
  try {
    return settleWhatsNewStatus(window.localStorage);
  } catch {
    return 'seen';
  }
}

const readServerStatus = (): WhatsNewStatus => 'seen';

export function useWhatsNewStatus(): WhatsNewStatus {
  return useSyncExternalStore(subscribe, readStatus, readServerStatus);
}

export function dismissWhatsNew(): void {
  try {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, 'seen');
  } catch {
    isDismissedWithoutStorage = true;
  }
  notify();
}

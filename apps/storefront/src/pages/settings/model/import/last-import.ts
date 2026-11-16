'use client';

import { useSyncExternalStore } from 'react';
import type { MediaImportResult } from '@/shared/api';
import type { ImportSource } from './import-sources';

const STORAGE_KEY = 'ratingo:last-import';
const STORAGE_VERSION = 1;

export interface LastImport {
  userId: string;
  source: ImportSource;
  finishedAt: number;
  result: MediaImportResult;
}

interface StoredImport {
  version: number;
  entry: LastImport;
}

const listeners = new Set<() => void>();
let hasRead = false;
let current: LastImport | undefined;

function parseStored(raw: string | null): LastImport | undefined {
  if (!raw) return undefined;
  try {
    const stored = JSON.parse(raw) as Partial<StoredImport>;
    return stored.version === STORAGE_VERSION ? stored.entry : undefined;
  } catch {
    return undefined;
  }
}

function readStored(): LastImport | undefined {
  if (hasRead) return current;
  hasRead = true;
  try {
    current = parseStored(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    current = undefined;
  }
  return current;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function forgetStored(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function rememberImport(entry: LastImport): void {
  hasRead = true;
  current = entry;
  listeners.forEach((listener) => listener());
  const stored: StoredImport = { version: STORAGE_VERSION, entry };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn('Saving the import summary failed', { error });
    forgetStored();
  }
}

export function useLastImport(userId: string | undefined): LastImport | undefined {
  const stored = useSyncExternalStore(subscribe, readStored, () => undefined);
  return stored && stored.userId === userId ? stored : undefined;
}

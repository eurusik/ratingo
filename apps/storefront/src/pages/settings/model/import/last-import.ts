'use client';

import { useSyncExternalStore } from 'react';
import type { MediaImportResult } from '@/shared/api';
import type { ImportSource } from './import-sources';

const STORAGE_KEY = 'ratingo:last-import';

export interface LastImport {
  userId: string;
  source: ImportSource;
  finishedAt: number;
  result: MediaImportResult;
}

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedValue: LastImport | undefined;

function readStored(): LastImport | undefined {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? (JSON.parse(raw) as LastImport) : undefined;
  } catch {
    cachedValue = undefined;
  }
  return cachedValue;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function rememberImport(entry: LastImport): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch (error) {
    console.warn('Saving the import summary failed', { error });
  }
  listeners.forEach((listener) => listener());
}

export function useLastImport(userId: string | undefined): LastImport | undefined {
  const stored = useSyncExternalStore(subscribe, readStored, () => undefined);
  return stored && stored.userId === userId ? stored : undefined;
}

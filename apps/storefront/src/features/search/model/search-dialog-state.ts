'use client';

import { useSyncExternalStore } from 'react';

let isOpen = false;
let pendingQuery = '';
const listeners = new Set<() => void>();

function publish(next: boolean): void {
  if (next === isOpen) return;
  isOpen = next;
  if (!isOpen) pendingQuery = '';
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const readIsOpen = () => isOpen;
const readServerIsOpen = () => false;

export function openSearch(): void {
  publish(true);
}

export function openSearchFor(query: string): void {
  pendingQuery = query;
  publish(true);
}

export function readPendingQuery(): string {
  return pendingQuery;
}

export function setSearchOpen(next: boolean): void {
  publish(next);
}

export function toggleSearch(): void {
  publish(!isOpen);
}

export function useIsSearchOpen(): boolean {
  return useSyncExternalStore(subscribe, readIsOpen, readServerIsOpen);
}

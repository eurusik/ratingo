'use client';

import { useSyncExternalStore } from 'react';

let isOpen = false;
const listeners = new Set<() => void>();

function publish(next: boolean): void {
  if (next === isOpen) return;
  isOpen = next;
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

export function setSearchOpen(next: boolean): void {
  publish(next);
}

export function toggleSearch(): void {
  publish(!isOpen);
}

export function useIsSearchOpen(): boolean {
  return useSyncExternalStore(subscribe, readIsOpen, readServerIsOpen);
}

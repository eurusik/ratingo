'use client';

import { useSyncExternalStore } from 'react';

interface IdSet {
  add(id: string): void;
  remove(id: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
  read(): ReadonlySet<string>;
}

const NOTHING: ReadonlySet<string> = new Set();
const readNothing = () => NOTHING;

export function createIdSet(): IdSet {
  let ids: ReadonlySet<string> = NOTHING;
  const listeners = new Set<() => void>();

  const publish = (next: ReadonlySet<string>) => {
    ids = next;
    listeners.forEach((listener) => listener());
  };

  return {
    add: (id) => {
      if (!ids.has(id)) publish(new Set(ids).add(id));
    },
    remove: (id) => {
      if (!ids.has(id)) return;
      const next = new Set(ids);
      next.delete(id);
      publish(next);
    },
    clear: () => {
      if (ids.size > 0) publish(NOTHING);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read: () => ids,
  };
}

export function useIds(set: IdSet): ReadonlySet<string> {
  return useSyncExternalStore(set.subscribe, set.read, readNothing);
}

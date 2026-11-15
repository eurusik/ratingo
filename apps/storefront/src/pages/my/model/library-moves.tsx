'use client';

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import type { LibraryList } from '@/entities/library';

type Destination = LibraryList | 'gone';

export interface LibraryMoves {
  isMovedOut: (mediaItemId: string, list: LibraryList) => boolean;
  track: (mediaItemId: string, destination: Destination) => void;
  forget: (mediaItemId: string) => void;
}

const LibraryMovesContext = createContext<LibraryMoves | null>(null);

export function LibraryMovesProvider({ children }: { children: ReactNode }) {
  const [moved, setMoved] = useState<ReadonlyMap<string, Destination>>(new Map());

  const track = useCallback((mediaItemId: string, destination: Destination) => {
    setMoved((current) => new Map(current).set(mediaItemId, destination));
  }, []);

  const forget = useCallback((mediaItemId: string) => {
    setMoved((current) => {
      if (!current.has(mediaItemId)) return current;
      const next = new Map(current);
      next.delete(mediaItemId);
      return next;
    });
  }, []);

  const value = useMemo<LibraryMoves>(
    () => ({
      isMovedOut: (mediaItemId, list) => {
        const destination = moved.get(mediaItemId);
        return destination !== undefined && destination !== list;
      },
      track,
      forget,
    }),
    [moved, track, forget],
  );

  return <LibraryMovesContext value={value}>{children}</LibraryMovesContext>;
}

export function useLibraryMoves(): LibraryMoves {
  const moves = use(LibraryMovesContext);
  if (!moves) throw new Error('useLibraryMoves must be used inside LibraryMovesProvider');
  return moves;
}

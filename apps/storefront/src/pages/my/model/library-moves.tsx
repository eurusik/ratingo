'use client';

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LibraryList } from '@/entities/library';

type Destination = LibraryList | 'gone';

interface TrackedMove {
  destination: Destination;
  token: number;
}

export interface LibraryMoves {
  isMovedOut: (mediaItemId: string, list: LibraryList) => boolean;
  track: (mediaItemId: string, destination: Destination) => number;
  forget: (mediaItemId: string, token: number) => void;
}

const LibraryMovesContext = createContext<LibraryMoves | null>(null);

export function LibraryMovesProvider({ children }: { children: ReactNode }) {
  const [moved, setMoved] = useState<ReadonlyMap<string, TrackedMove>>(new Map());
  const nextToken = useRef(0);

  const track = useCallback((mediaItemId: string, destination: Destination) => {
    nextToken.current += 1;
    const token = nextToken.current;
    setMoved((current) => new Map(current).set(mediaItemId, { destination, token }));
    return token;
  }, []);

  const forget = useCallback((mediaItemId: string, token: number) => {
    setMoved((current) => {
      if (current.get(mediaItemId)?.token !== token) return current;
      const next = new Map(current);
      next.delete(mediaItemId);
      return next;
    });
  }, []);

  const value = useMemo<LibraryMoves>(
    () => ({
      isMovedOut: (mediaItemId, list) => {
        const move = moved.get(mediaItemId);
        return move !== undefined && move.destination !== list;
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

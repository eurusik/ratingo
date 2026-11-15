'use client';

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LibraryList } from '@/entities/library';

type Destination = LibraryList | 'gone';

interface TrackedMove {
  destination: Destination;
  token: number;
}

interface LibraryMoveActions {
  track: (mediaItemId: string, destination: Destination) => number;
  forget: (mediaItemId: string, token: number) => void;
}

type IsMovedOut = (mediaItemId: string, list: LibraryList) => boolean;

const MoveActionsContext = createContext<LibraryMoveActions | null>(null);
const MovedOutContext = createContext<IsMovedOut | null>(null);

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

  const actions = useMemo(() => ({ track, forget }), [track, forget]);
  const isMovedOut = useCallback<IsMovedOut>(
    (mediaItemId, list) => {
      const move = moved.get(mediaItemId);
      return move !== undefined && move.destination !== list;
    },
    [moved],
  );

  return (
    <MoveActionsContext value={actions}>
      <MovedOutContext value={isMovedOut}>{children}</MovedOutContext>
    </MoveActionsContext>
  );
}

export function useLibraryMoveActions(): LibraryMoveActions {
  const actions = use(MoveActionsContext);
  if (!actions) throw new Error('useLibraryMoveActions must be used inside LibraryMovesProvider');
  return actions;
}

export function useIsMovedOut(): IsMovedOut {
  const isMovedOut = use(MovedOutContext);
  if (!isMovedOut) throw new Error('useIsMovedOut must be used inside LibraryMovesProvider');
  return isMovedOut;
}

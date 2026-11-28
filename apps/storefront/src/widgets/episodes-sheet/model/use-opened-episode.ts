'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { episodeRowSelector, type Episode } from '@/entities/episode';

export interface OpenedEpisode {
  episode?: Episode;
  listRef: RefObject<HTMLUListElement | null>;
  open: (episode: Episode) => void;
  close: () => void;
}

export function useOpenedEpisode(): OpenedEpisode {
  const [episode, setEpisode] = useState<Episode>();
  const listRef = useRef<HTMLUListElement>(null);
  const returnTo = useRef<Episode | undefined>(undefined);

  const open = useCallback((target: Episode) => setEpisode(target), []);
  const close = useCallback(() => {
    returnTo.current = episode;
    setEpisode(undefined);
  }, [episode]);

  useEffect(() => {
    if (episode || !returnTo.current) return;
    const row = listRef.current?.querySelector<HTMLElement>(episodeRowSelector(returnTo.current));
    returnTo.current = undefined;
    row?.scrollIntoView({ block: 'center' });
    row?.querySelector('button')?.focus({ preventScroll: true });
  }, [episode]);

  return { episode, listRef, open, close };
}

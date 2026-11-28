'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { EPISODE_KEY_ATTRIBUTE, episodeKey, type Episode } from '@/entities/episode';

export interface OpenedEpisode {
  episode?: Episode;
  listRef: RefObject<HTMLUListElement | null>;
  open: (episode: Episode) => void;
  close: () => void;
}

export function useOpenedEpisode(): OpenedEpisode {
  const [episode, setEpisode] = useState<Episode>();
  const listRef = useRef<HTMLUListElement>(null);
  const returnTo = useRef<string | undefined>(undefined);

  const open = useCallback((target: Episode) => setEpisode(target), []);
  const close = useCallback(() => {
    if (episode) returnTo.current = episodeKey(episode);
    setEpisode(undefined);
  }, [episode]);

  useEffect(() => {
    if (episode || !returnTo.current) return;
    const row = listRef.current?.querySelector<HTMLElement>(
      `[${EPISODE_KEY_ATTRIBUTE}="${returnTo.current}"]`,
    );
    returnTo.current = undefined;
    row?.scrollIntoView({ block: 'center' });
    row?.querySelector('button')?.focus({ preventScroll: true });
  }, [episode]);

  return { episode, listRef, open, close };
}

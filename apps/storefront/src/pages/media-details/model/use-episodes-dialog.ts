'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Season } from '@/entities/episode';
import { isPickLink, linkedSeason, seasonParam, withoutSeasonParam } from './season-link';

export interface EpisodesDialog {
  isOpen: boolean;
  isPicking: boolean;
  hasOpened: boolean;
  initialSeason?: number;
}

const CLOSED_DIALOG: EpisodesDialog = { isOpen: false, isPicking: false, hasOpened: false };

function subscribeToHistory(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

const readSearch = () => window.location.search;
const readServerSearch = () => '';

function forgetSeasonLink(): void {
  window.history.replaceState(window.history.state, '', withoutSeasonParam(window.location));
}

type SeasonLink = number | 'pick';

function deriveDialog(stored: EpisodesDialog, linked: SeasonLink | undefined): EpisodesDialog {
  if (linked === undefined) return stored;
  if (linked === 'pick') return { isOpen: true, isPicking: true, hasOpened: true };
  return { isOpen: true, isPicking: false, hasOpened: true, initialSeason: linked };
}

interface EpisodesDialogInputs {
  seasons: readonly Season[];
  canTrack: boolean;
  isResolving: boolean;
}

export function useEpisodesDialog({ seasons, canTrack, isResolving }: EpisodesDialogInputs) {
  const search = useSyncExternalStore(subscribeToHistory, readSearch, readServerSearch);
  const [stored, setStored] = useState<EpisodesDialog>(CLOSED_DIALOG);
  const [consumedParam, setConsumedParam] = useState<string | null>(null);
  const param = seasonParam(search);
  const requested: SeasonLink | undefined =
    isPickLink(search) && seasons.length > 0
      ? 'pick'
      : linkedSeason(
          search,
          seasons.map((season) => season.number),
        );
  const isConsumed = param !== null && param === consumedParam;
  const linked = canTrack && !isConsumed ? requested : undefined;
  const dialog = deriveDialog(stored, linked);
  const isLinkUnusable = param !== null && !isResolving && (!canTrack || requested === undefined);

  useEffect(() => {
    if (isLinkUnusable) forgetSeasonLink();
  }, [isLinkUnusable]);

  const consumeLink = () => {
    if (linked === undefined) return;
    setConsumedParam(param);
    forgetSeasonLink();
  };

  const update = (patch: Partial<EpisodesDialog>) => {
    consumeLink();
    setStored({ ...dialog, ...patch });
  };

  return {
    dialog,
    open: (isPicking: boolean) =>
      update({ isOpen: true, isPicking, hasOpened: true, initialSeason: undefined }),
    setOpen: (isOpen: boolean) => update({ isOpen }),
    setPicking: (isPicking: boolean) => update({ isPicking }),
  };
}

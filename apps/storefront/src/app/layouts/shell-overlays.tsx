'use client';

import { useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useForgetLibraryOnUserChange } from '@/entities/library';
import { SearchShortcut, useIsSearchOpen, type SearchTitle } from '@/features/search';
import { hasPendingIntent, useAuthRequest } from '@/shared/auth';
import { InstallPromptCapture } from '@/shared/lib';
import {
  loadAuthDialog,
  loadPendingSaveReplay,
  loadSaveButton,
  loadSearchDialog,
  useWarmOverlays,
} from './overlay-loaders';

const AuthDialog = dynamic(loadAuthDialog, { ssr: false });
const SearchDialog = dynamic(loadSearchDialog, { ssr: false });
const SaveButton = dynamic(loadSaveButton, { ssr: false });
const PendingSaveReplay = dynamic(loadPendingSaveReplay, { ssr: false });

function renderSearchActions({ isInCatalog, mediaItemId, slug, title, type }: SearchTitle) {
  if (!isInCatalog || !mediaItemId || !slug) return null;
  return <SaveButton media={{ mediaItemId, slug, title, type }} />;
}

function useHasOpened(isOpen: boolean): boolean {
  const [hasOpened, setHasOpened] = useState(isOpen);
  if (isOpen && !hasOpened) setHasOpened(true);
  return hasOpened;
}

const subscribeToNothing = () => () => {};
const readNoIntentOnServer = () => false;

export function ShellOverlays() {
  const hasOpenedSearch = useHasOpened(useIsSearchOpen());
  const hasOpenedAuth = useHasOpened(useAuthRequest() !== null);
  const hasIntentFromRedirect = useSyncExternalStore(
    subscribeToNothing,
    hasPendingIntent,
    readNoIntentOnServer,
  );
  useForgetLibraryOnUserChange();
  const isWarm = useWarmOverlays();

  return (
    <>
      <SearchShortcut />
      <InstallPromptCapture />
      {hasIntentFromRedirect ? <PendingSaveReplay /> : null}
      {isWarm || hasOpenedSearch ? <SearchDialog renderActions={renderSearchActions} /> : null}
      {isWarm || hasOpenedAuth ? <AuthDialog /> : null}
    </>
  );
}

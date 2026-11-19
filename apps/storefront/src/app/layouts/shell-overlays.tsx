'use client';

import { useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useTrackingHintsSession } from '@/entities/episode';
import { useForgetLibraryOnUserChange } from '@/entities/library';
import {
  SearchShortcut,
  useIsSearchOpen,
  useSearchFromUrl,
  type SearchTitle,
} from '@/features/search';
import { WhatsNew } from '@/features/whats-new';
import { closeAuth, hasPendingIntent, useAuthRequest } from '@/shared/auth';
import { InstallPromptCapture } from '@/shared/lib';
import {
  loadAuthDialog,
  loadPendingSaveReplay,
  loadSaveButton,
  loadSearchDialog,
  useIsDialogCodePending,
  useWarmOverlays,
} from './overlay-loaders';
import { AuthDialogLoading } from './auth-dialog-loading';

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
  const isAuthRequested = useAuthRequest() !== null;
  const hasOpenedAuth = useHasOpened(isAuthRequested);
  const hasIntentFromRedirect = useSyncExternalStore(
    subscribeToNothing,
    hasPendingIntent,
    readNoIntentOnServer,
  );
  useForgetLibraryOnUserChange();
  useTrackingHintsSession();
  useSearchFromUrl();
  const isWarm = useWarmOverlays();
  const isAuthDialogPending = useIsDialogCodePending({
    isRequested: isAuthRequested,
    isWarm,
    load: loadAuthDialog,
    onLoadFailed: closeAuth,
  });

  return (
    <>
      <SearchShortcut />
      <InstallPromptCapture />
      {hasIntentFromRedirect ? <PendingSaveReplay /> : null}
      {isWarm || hasOpenedSearch ? <SearchDialog renderActions={renderSearchActions} /> : null}
      {isWarm || hasOpenedAuth ? <AuthDialog /> : null}
      {isAuthDialogPending ? <AuthDialogLoading /> : null}
      <WhatsNew />
    </>
  );
}

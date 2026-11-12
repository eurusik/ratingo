'use client';

import { useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useForgetLibraryOnUserChange } from '@/entities/library';
import { SearchShortcut, useIsSearchOpen, type SearchTitle } from '@/features/search';
import { hasPendingIntent, useAuthRequest } from '@/shared/auth';
import { InstallPromptCapture } from '@/shared/lib';

const AuthDialog = dynamic(
  () => import('@/features/authenticate').then((module) => module.AuthDialog),
  { ssr: false },
);

const SearchDialog = dynamic(
  () => import('@/features/search').then((module) => module.SearchDialog),
  { ssr: false },
);

const SaveButton = dynamic(
  () => import('@/features/save-to-library').then((module) => module.SaveButton),
  { ssr: false },
);

const PendingSaveReplay = dynamic(
  () => import('@/features/save-to-library').then((module) => module.PendingSaveReplay),
  { ssr: false },
);

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

  return (
    <>
      <SearchShortcut />
      <InstallPromptCapture />
      {hasIntentFromRedirect ? <PendingSaveReplay /> : null}
      {hasOpenedSearch ? <SearchDialog renderActions={renderSearchActions} /> : null}
      {hasOpenedAuth ? <AuthDialog /> : null}
    </>
  );
}

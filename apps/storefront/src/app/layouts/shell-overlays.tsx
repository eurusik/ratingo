'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { SaveButton, useReplaySaveAfterSignIn } from '@/features/save-to-library';
import { SearchShortcut, useIsSearchOpen, type SearchTitle } from '@/features/search';
import { useAuthRequest } from '@/shared/auth';
import { InstallPromptCapture } from '@/shared/lib';

const AuthDialog = dynamic(
  () => import('@/features/authenticate').then((module) => module.AuthDialog),
  { ssr: false },
);

const SearchDialog = dynamic(
  () => import('@/features/search').then((module) => module.SearchDialog),
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

export function ShellOverlays() {
  const hasOpenedSearch = useHasOpened(useIsSearchOpen());
  const hasOpenedAuth = useHasOpened(useAuthRequest() !== null);
  useReplaySaveAfterSignIn();

  return (
    <>
      <SearchShortcut />
      <InstallPromptCapture />
      {hasOpenedSearch ? <SearchDialog renderActions={renderSearchActions} /> : null}
      {hasOpenedAuth ? <AuthDialog /> : null}
    </>
  );
}

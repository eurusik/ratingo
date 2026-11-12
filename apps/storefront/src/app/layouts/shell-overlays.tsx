'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { SearchShortcut, useIsSearchOpen, type SearchTitle } from '@/features/search';
import { useAuthRequest } from '@/shared/auth';
import { InstallPromptCapture } from '@/shared/lib';
import { GuestSaveButton } from './guest-save-button';

const AuthDialog = dynamic(
  () => import('@/features/authenticate').then((module) => module.AuthDialog),
  { ssr: false },
);

const SearchDialog = dynamic(
  () => import('@/features/search').then((module) => module.SearchDialog),
  { ssr: false },
);

const saveBeforeSaveMediaExists = () => {};

function renderSearchActions(title: SearchTitle) {
  return <GuestSaveButton title={title} onSave={saveBeforeSaveMediaExists} />;
}

function useHasOpened(isOpen: boolean): boolean {
  const [hasOpened, setHasOpened] = useState(isOpen);
  if (isOpen && !hasOpened) setHasOpened(true);
  return hasOpened;
}

export function ShellOverlays() {
  const hasOpenedSearch = useHasOpened(useIsSearchOpen());
  const hasOpenedAuth = useHasOpened(useAuthRequest() !== null);

  return (
    <>
      <SearchShortcut />
      <InstallPromptCapture />
      {hasOpenedSearch ? <SearchDialog renderActions={renderSearchActions} /> : null}
      {hasOpenedAuth ? <AuthDialog /> : null}
    </>
  );
}

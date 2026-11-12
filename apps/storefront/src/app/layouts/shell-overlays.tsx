'use client';

import dynamic from 'next/dynamic';
import { SearchShortcut, type SearchTitle } from '@/features/search';
import { InstallPromptCapture } from '@/shared/lib';
import { GuestSaveButton } from './guest-save-button';

const AuthDialog = dynamic(
  () => import('@/features/authenticate').then((module) => module.AuthDialog),
  {
    ssr: false,
  },
);

const SearchDialog = dynamic(
  () => import('@/features/search').then((module) => module.SearchDialog),
  {
    ssr: false,
  },
);

function renderSearchActions(title: SearchTitle) {
  return <GuestSaveButton title={title} />;
}

export function ShellOverlays() {
  return (
    <>
      <SearchShortcut />
      <InstallPromptCapture />
      <SearchDialog renderActions={renderSearchActions} />
      <AuthDialog />
    </>
  );
}

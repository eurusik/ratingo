import { useEffect, useEffectEvent, useState } from 'react';
import { tokenStorage } from '@ratingo/web-core/auth';
import { useDebouncedValue, whenIdleOnFastConnection } from '@/shared/lib';

export const loadAuthDialog = () =>
  import('@/features/authenticate').then((module) => module.AuthDialog);

export const loadSearchDialog = () =>
  import('@/features/search').then((module) => module.SearchDialog);

export const loadSaveButton = () =>
  import('@/features/save-to-library').then((module) => module.SaveButton);

const warmSaveMenuButton = () =>
  import('@/features/save-to-library').then((module) => module.preloadSaveMenuButton());

export const loadPendingSaveReplay = () =>
  import('@/features/save-to-library').then((module) => module.PendingSaveReplay);

const PENDING_NOTICE_DELAY_MS = 150;

function preloaded(load: () => Promise<unknown>): Promise<boolean> {
  return load().then(
    () => true,
    () => false,
  );
}

function warmTheRest(): Promise<boolean> {
  void preloaded(warmSaveMenuButton);
  return preloaded(loadSearchDialog);
}

async function warmOverlays(signInFirst: boolean): Promise<boolean> {
  if (signInFirst) {
    const isSignInWarm = await preloaded(loadAuthDialog);
    return (await warmTheRest()) && isSignInWarm;
  }
  const warmed = await Promise.all([preloaded(loadAuthDialog), warmTheRest()]);
  return warmed.every(Boolean);
}

function hasStoredSession(): boolean {
  try {
    return tokenStorage.getRefreshToken() !== null;
  } catch {
    return false;
  }
}

export function useWarmOverlays(): boolean {
  const [isWarm, setIsWarm] = useState(false);

  useEffect(
    () =>
      whenIdleOnFastConnection(() => {
        void warmOverlays(!hasStoredSession()).then(setIsWarm);
      }),
    [],
  );

  return isWarm;
}

interface LazyDialogCode {
  isRequested: boolean;
  isWarm: boolean;
  load: () => Promise<unknown>;
  onLoadFailed: () => void;
}

function useIsDialogCodeLoaded({ isRequested, load, onLoadFailed }: LazyDialogCode): boolean {
  const [isLoaded, setIsLoaded] = useState(false);
  const failToLoad = useEffectEvent(onLoadFailed);

  useEffect(() => {
    if (!isRequested || isLoaded) return;
    let isCurrent = true;
    load().then(
      () => {
        if (isCurrent) setIsLoaded(true);
      },
      () => {
        if (isCurrent) failToLoad();
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [isRequested, isLoaded, load]);

  return isLoaded;
}

export function useIsDialogCodePending(dialog: LazyDialogCode): boolean {
  const isLoaded = useIsDialogCodeLoaded(dialog);
  const isPending = dialog.isRequested && !dialog.isWarm && !isLoaded;
  const hasBeenPendingAWhile = useDebouncedValue(isPending, PENDING_NOTICE_DELAY_MS);
  return isPending && hasBeenPendingAWhile;
}

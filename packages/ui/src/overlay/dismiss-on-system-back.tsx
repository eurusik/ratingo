'use client';

import { useContext, useEffect } from 'react';
import { OverlayTriggerStateContext } from 'react-aria-components';

interface CloseWatcherInstance {
  onclose: (() => void) | null;
  destroy(): void;
}

type CloseWatcherConstructor = new () => CloseWatcherInstance;

function findCloseWatcher(): CloseWatcherConstructor | undefined {
  return (globalThis as { CloseWatcher?: CloseWatcherConstructor }).CloseWatcher;
}

export function DismissOnSystemBack() {
  const overlay = useContext(OverlayTriggerStateContext);
  const isOpen = overlay?.isOpen ?? false;
  const close = overlay?.close;

  useEffect(() => {
    const CloseWatcher = findCloseWatcher();
    if (!isOpen || !close || !CloseWatcher) return;

    const watcher = new CloseWatcher();
    watcher.onclose = close;
    return () => watcher.destroy();
  }, [isOpen, close]);

  return null;
}

'use client';

import { useState, useSyncExternalStore } from 'react';

const ROW_HINT_SEEN_KEY = 'ratingo:episode-row-hint-seen';

function hasSeenHint(): boolean {
  try {
    return window.localStorage.getItem(ROW_HINT_SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

function rememberHintSeen(): void {
  try {
    window.localStorage.setItem(ROW_HINT_SEEN_KEY, '1');
  } catch {
    return;
  }
}

const subscribeToNothing = () => () => undefined;

export interface RowHint {
  isVisible: boolean;
  dismiss: () => void;
}

export function useRowHint(): RowHint {
  const wasSeen = useSyncExternalStore(subscribeToNothing, hasSeenHint, () => true);
  const [isDismissed, setDismissed] = useState(false);

  return {
    isVisible: !wasSeen && !isDismissed,
    dismiss: () => {
      rememberHintSeen();
      setDismissed(true);
    },
  };
}

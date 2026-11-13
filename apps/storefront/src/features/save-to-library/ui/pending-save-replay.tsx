'use client';

import { useReplaySaveAfterSignIn } from '../model/pending-save';

export function PendingSaveReplay() {
  useReplaySaveAfterSignIn();
  return null;
}

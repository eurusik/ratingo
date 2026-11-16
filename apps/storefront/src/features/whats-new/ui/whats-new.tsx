'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { WHATS_NEW_CALM_DELAY_MS } from '../config/whats-new';
import { useOnCalmMoment } from '../model/calm-moment';
import { isWhatsNewEntryRoute } from '../model/entry-route';
import { useHasOpenOverlay } from '../model/overlay-presence';
import { dismissWhatsNew, useWhatsNewStatus } from '../model/whats-new-status';

const loadWhatsNewDialog = () =>
  import('./whats-new-dialog').then(({ WhatsNewDialog }) => WhatsNewDialog);

const WhatsNewDialog = dynamic(loadWhatsNewDialog, { ssr: false });

export function WhatsNew() {
  const isDue = useWhatsNewStatus() === 'due';
  const isOnEntryRoute = isWhatsNewEntryRoute(usePathname());
  const [hasOpened, setHasOpened] = useState(false);
  const isWaiting = isDue && isOnEntryRoute && !hasOpened;
  const hasOpenOverlay = useHasOpenOverlay(isWaiting);
  const isClear = isWaiting && !hasOpenOverlay;

  useEffect(() => {
    if (isWaiting) void loadWhatsNewDialog();
  }, [isWaiting]);

  const open = useCallback(() => setHasOpened(true), []);
  useOnCalmMoment(isClear, WHATS_NEW_CALM_DELAY_MS, open);

  if (!hasOpened) return null;

  return <WhatsNewDialog isOpen={isDue} onDismiss={dismissWhatsNew} />;
}

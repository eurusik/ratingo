/**
 * Listens for online/offline events and shows toast notifications.
 * Renders nothing — just registers listeners on mount.
 */

'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/shared/hooks';
import { useTranslation } from '@/shared/i18n';

export function NetworkStatusListener() {
  const isOnline = useOnlineStatus();
  const prevRef = useRef(isOnline);
  const { dict } = useTranslation();

  useEffect(() => {
    if (prevRef.current === isOnline) return;
    prevRef.current = isOnline;

    if (!isOnline) {
      toast.error(dict.pwa.offline, {
        description: dict.pwa.offlineDescription,
        duration: Infinity,
        id: 'offline-toast',
      });
    } else {
      toast.dismiss('offline-toast');
      toast.success(dict.pwa.connectionRestored, { duration: 3000 });
    }
  }, [isOnline, dict]);

  return null;
}

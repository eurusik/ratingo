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
  const dictRef = useRef(dict);
  dictRef.current = dict;

  useEffect(() => {
    if (prevRef.current === isOnline) return;
    prevRef.current = isOnline;

    const d = dictRef.current;
    if (!isOnline) {
      toast.error(d.pwa.offline, {
        description: d.pwa.offlineDescription,
        duration: Infinity,
        id: 'offline-toast',
      });
    } else {
      toast.dismiss('offline-toast');
      toast.success(d.pwa.connectionRestored, { duration: 3000 });
    }
  }, [isOnline]);

  return null;
}

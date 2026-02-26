'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

/**
 * Tracks online/offline status and shows toast notifications on change.
 */
export function useOnlineStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const prevRef = useRef(isOnline);

  useEffect(() => {
    if (prevRef.current === isOnline) return;
    prevRef.current = isOnline;

    if (!isOnline) {
      toast.error('Ви офлайн', {
        description: 'Деякі функції можуть бути недоступні',
        duration: Infinity,
        id: 'offline-toast',
      });
    } else {
      toast.dismiss('offline-toast');
      toast.success("З'єднання відновлено", { duration: 3000 });
    }
  }, [isOnline]);

  return isOnline;
}

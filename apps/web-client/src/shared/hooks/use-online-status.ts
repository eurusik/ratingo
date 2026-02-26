'use client';

import { useEffect, useSyncExternalStore } from 'react';
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

  useEffect(() => {
    // Skip initial render — only react to changes
    let initialized = false;

    function handleOffline() {
      if (initialized) {
        toast.error('Ви офлайн', {
          description: 'Деякі функції можуть бути недоступні',
          duration: Infinity,
          id: 'offline-toast',
        });
      }
    }

    function handleOnline() {
      if (initialized) {
        toast.dismiss('offline-toast');
        toast.success("З'єднання відновлено", { duration: 3000 });
      }
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    initialized = true;

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return isOnline;
}

/**
 * Listens for online/offline events and shows toast notifications.
 * Renders nothing — just registers listeners on mount.
 */

'use client';

import { useOnlineStatus } from '@/shared/hooks';

export function NetworkStatusListener() {
  useOnlineStatus();
  return null;
}

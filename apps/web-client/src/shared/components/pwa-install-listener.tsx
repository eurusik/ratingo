/**
 * Captures the beforeinstallprompt event globally.
 * Renders nothing — just registers the event listener on mount.
 */

'use client';

import { usePwaInstall } from '@/shared/hooks';

export function PwaInstallListener() {
  usePwaInstall();
  return null;
}

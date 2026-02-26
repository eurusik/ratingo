'use client';

import { useCallback, useState } from 'react';

interface ShareData {
  title: string;
  text?: string;
  url: string;
}

export function useWebShare() {
  const [copied, setCopied] = useState(false);

  const share = useCallback(async (data: ShareData) => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (requires HTTPS)
    }
  }, []);

  return { share, copied };
}

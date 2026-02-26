'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ShareData {
  title: string;
  text?: string;
  url: string;
}

export function useWebShare() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

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
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (requires HTTPS)
    }
  }, []);

  return { share, copied };
}

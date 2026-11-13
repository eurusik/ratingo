'use client';

import { useCallback } from 'react';
import { toast } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { useBrowserOrigin } from '../browser-origin';

type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

interface SharedLink {
  href: string;
  title: string;
}

function isUserCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function shareLink(link: { url: string; title: string }): Promise<ShareOutcome> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share(link);
      return 'shared';
    }
    await navigator.clipboard.writeText(link.url);
    return 'copied';
  } catch (error) {
    if (isUserCancel(error)) return 'cancelled';
    console.error('Sharing a title failed', { url: link.url, error });
    return 'failed';
  }
}

export function useShareLink(): (link: SharedLink) => Promise<void> {
  const { dict } = useTranslation();
  const origin = useBrowserOrigin();

  return useCallback(
    async ({ href, title }) => {
      if (!origin) return;
      const outcome = await shareLink({ url: new URL(href, origin).href, title });
      if (outcome === 'copied') toast(dict.common.linkCopied);
      if (outcome === 'failed') toast.danger(dict.common.shareFailed);
    },
    [dict, origin],
  );
}

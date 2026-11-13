'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mediaRoute } from '@/shared/config';
import { importUntilReady } from './import-title';
import { rememberTitle } from './recent-titles';
import type { SearchTitle } from './search-title';

export interface TitleImport {
  title: SearchTitle;
  hasFailed: boolean;
}

export function useOpenTitle(onOpened: () => void) {
  const router = useRouter();
  const [titleImport, setTitleImport] = useState<TitleImport | null>(null);
  const activeImport = useRef<AbortController | null>(null);

  useEffect(() => () => activeImport.current?.abort(), []);

  const navigate = (title: SearchTitle, slug: string) => {
    rememberTitle({ ...title, slug });
    onOpened();
    router.push(mediaRoute(title.type, slug));
  };

  const startImport = (title: SearchTitle, tmdbId: number) => {
    activeImport.current?.abort();
    const controller = new AbortController();
    activeImport.current = controller;
    setTitleImport({ title, hasFailed: false });

    importUntilReady(title.type, tmdbId, controller.signal)
      .then((slug) => {
        if (controller.signal.aborted) return;
        setTitleImport(null);
        navigate(title, slug);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Title import failed', { type: title.type, tmdbId, error });
        setTitleImport({ title, hasFailed: true });
      });
  };

  const open = (title: SearchTitle) => {
    if (title.isInCatalog && title.slug) navigate(title, title.slug);
    else if (title.tmdbId !== undefined) startImport(title, title.tmdbId);
  };

  const cancelImport = () => {
    activeImport.current?.abort();
    activeImport.current = null;
    setTitleImport(null);
  };

  return { open, titleImport, cancelImport };
}

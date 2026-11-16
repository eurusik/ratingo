'use client';

import { useEffect } from 'react';
import { GlobalErrorPage } from '@/pages/global-error';
import { errorDigest } from '@/shared/lib';

interface GlobalErrorProps {
  error: unknown;
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Root layout failed to render', error);
  }, [error]);

  return <GlobalErrorPage digest={errorDigest(error)} />;
}

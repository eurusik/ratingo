'use client';

import { GlobalErrorPage } from '@/pages/global-error';
import { errorDigest, useLoggedError } from '@/shared/lib';

interface GlobalErrorProps {
  error: unknown;
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useLoggedError('Root layout failed to render', error);
  return <GlobalErrorPage digest={errorDigest(error)} />;
}

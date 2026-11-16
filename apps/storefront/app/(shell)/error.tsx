'use client';

import { useEffect } from 'react';
import { ErrorPage } from '@/pages/error';

interface ShellErrorBoundaryProps {
  error: unknown;
  retry: () => void;
}

export default function ShellErrorBoundary({ error, retry }: ShellErrorBoundaryProps) {
  useEffect(() => {
    console.error('Page failed to render', error);
  }, [error]);

  return <ErrorPage error={error} onRetry={retry} />;
}

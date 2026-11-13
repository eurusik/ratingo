'use client';

import { useEffect } from 'react';
import { DetailsError } from '@/pages/media-details/index.client';

interface DetailsErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DetailsErrorBoundary({ error, reset }: DetailsErrorBoundaryProps) {
  useEffect(() => {
    console.error('Details page failed to render', { digest: error.digest, error });
  }, [error]);

  return <DetailsError onRetry={reset} />;
}

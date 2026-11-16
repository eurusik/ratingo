'use client';

import { useEffect } from 'react';
import { DetailsError } from '@/pages/media-details/index.client';

interface DetailsErrorBoundaryProps {
  error: unknown;
  retry: () => void;
}

export default function DetailsErrorBoundary({ error, retry }: DetailsErrorBoundaryProps) {
  useEffect(() => {
    console.error('Details page failed to render', error);
  }, [error]);

  return <DetailsError error={error} onRetry={retry} />;
}

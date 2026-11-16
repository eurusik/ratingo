'use client';

import { DetailsError } from '@/pages/media-details/index.client';
import { useLoggedError } from '@/shared/lib';

interface DetailsErrorBoundaryProps {
  error: unknown;
  retry: () => void;
}

export default function DetailsErrorBoundary({ error, retry }: DetailsErrorBoundaryProps) {
  useLoggedError('Details page failed to render', error);
  return <DetailsError error={error} onRetry={retry} />;
}

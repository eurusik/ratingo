'use client';

import { DetailsError } from '@/pages/media-details/index.client';

export default function DetailsErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return <DetailsError onRetry={reset} />;
}

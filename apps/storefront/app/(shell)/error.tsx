'use client';

import { ErrorPage } from '@/pages/error';
import { useLoggedError } from '@/shared/lib';

interface ShellErrorBoundaryProps {
  error: unknown;
  retry: () => void;
}

export default function ShellErrorBoundary({ error, retry }: ShellErrorBoundaryProps) {
  useLoggedError('Page failed to render', error);
  return <ErrorPage error={error} onRetry={retry} />;
}

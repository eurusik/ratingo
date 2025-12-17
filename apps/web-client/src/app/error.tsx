'use client';

/**
 * Global error boundary for the application.
 * Catches errors in page components and displays a fallback UI.
 */

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/shared/i18n';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const { t } = useTranslation();

  useEffect(() => {
    // Log error to console (can be replaced with error reporting service)
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          {t('error.title')}
        </h1>

        {/* Description */}
        <p className="text-zinc-400 mb-8">
          {t('error.description')}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('error.tryAgain')}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            {t('common.home')}
          </Link>
        </div>

        {/* Error digest (for debugging) */}
        {error.digest && (
          <p className="mt-8 text-xs text-zinc-600">
            {t('error.errorCode')}: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}

'use client';

import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

export default function OfflinePage() {
  const { dict } = useTranslation();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div
          className="mx-auto w-16 h-16 bg-cinema-elevated rounded-full flex items-center justify-center mb-6"
          aria-hidden="true"
        >
          <WifiOff className="w-8 h-8 text-cinema-text-muted" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{dict.pwa.offline}</h1>

        <p className="text-cinema-text-muted mb-8">{dict.pwa.offlineDescription}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            {dict.pwa.retry}
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/">
              <Home className="w-4 h-4 mr-2" aria-hidden="true" />
              {dict.common.home}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/ui';

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8 text-blue-500" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Ви офлайн</h1>

        <p className="text-cinema-text-muted mb-8">
          Немає з&apos;єднання з інтернетом. Перевірте підключення та спробуйте ще раз.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Спробувати знову
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              На головну
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

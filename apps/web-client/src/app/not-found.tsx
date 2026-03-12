/**
 * Custom 404 page.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'Сторінку не знайдено',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <div className="text-8xl font-bold gradient-text">404</div>
        <h1 className="text-2xl font-semibold text-white">Сторінку не знайдено</h1>
        <p className="text-cinema-text-muted max-w-md">Ця сторінка не існує або була переміщена.</p>
        <Button variant="outline" asChild>
          <Link href="/">← На головну</Link>
        </Button>
      </div>
    </main>
  );
}

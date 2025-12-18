/**
 * Not found view for details pages.
 */

import Link from 'next/link';
import type { Route } from 'next';
import type { LucideIcon } from 'lucide-react';

interface NotFoundViewProps {
  icon: LucideIcon;
  message: string;
  backLabel: string;
}

export function NotFoundView({ icon: Icon, message, backLabel }: NotFoundViewProps) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Icon className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">{message}</h1>
        <Link href={'/' as Route} className="text-blue-400 hover:text-blue-300">
          ← {backLabel}
        </Link>
      </div>
    </main>
  );
}

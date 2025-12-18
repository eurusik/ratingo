/**
 * Sticky header for details pages with back button and share.
 */

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Share2 } from 'lucide-react';

interface DetailsHeaderProps {
  backLabel: string;
}

export function DetailsHeader({ backLabel }: DetailsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-transparent backdrop-blur border-b border-zinc-800">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href={'/' as Route}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">{backLabel}</span>
        </Link>
        <button className="text-zinc-400 hover:text-white transition-colors p-2">
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

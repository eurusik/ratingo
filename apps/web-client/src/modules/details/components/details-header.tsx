/**
 * Sticky header for details pages with back button and share.
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Share2, Check } from 'lucide-react';
import { useWebShare } from '@/shared/hooks';

interface DetailsHeaderProps {
  backLabel: string;
  shareTitle?: string;
}

export function DetailsHeader({ backLabel, shareTitle }: DetailsHeaderProps) {
  const { share, copied } = useWebShare();

  const handleShare = () => {
    share({
      title: shareTitle ?? 'Ratingo',
      url: window.location.href,
    });
  };

  return (
    <header className="sticky top-0 z-50 bg-transparent backdrop-blur border-b border-cinema-borderSoft">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href={'/' as Route}
          className="flex items-center gap-2 text-cinema-text-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">{backLabel}</span>
        </Link>
        <button
          onClick={handleShare}
          className="text-cinema-text-muted hover:text-white transition-colors p-2"
          aria-label="Поділитись"
        >
          {copied ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : (
            <Share2 className="w-5 h-5" />
          )}
        </button>
      </div>
    </header>
  );
}

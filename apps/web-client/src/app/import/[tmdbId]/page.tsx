'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { Loader2, Film, Tv, CheckCircle, XCircle } from 'lucide-react';

import { catalogApi, ImportStatus } from '@/core/api/catalog';
import { useTranslation } from '@/shared/i18n';

interface ImportPageProps {
  params: Promise<{ tmdbId: string }>;
}

export default function ImportPage({ params }: ImportPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dict } = useTranslation();

  // Unwrap params (Next.js 15 async params)
  const tmdbId = parseInt((params as any).tmdbId || '0', 10);
  const type = (searchParams.get('type') as 'movie' | 'show') || 'movie';
  const title = searchParams.get('title') || '';
  const poster = searchParams.get('poster') || '';
  const year = searchParams.get('year') || '';

  // Poll for import status every 2 seconds
  const { data: status, isLoading } = useQuery({
    queryKey: ['import-status', tmdbId],
    queryFn: () => catalogApi.checkImportStatus(tmdbId),
    enabled: tmdbId > 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when ready or failed
      if (data?.status === ImportStatus.READY || data?.status === ImportStatus.FAILED) {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Redirect when import is complete
  useEffect(() => {
    if (status?.status === ImportStatus.READY && status.slug) {
      const path = status.type === 'movie' ? `/movies/${status.slug}` : `/shows/${status.slug}`;
      router.replace(path as any);
    }
  }, [status, router]);

  const Icon = type === 'movie' ? Film : Tv;
  const typeLabel = type === 'movie' ? dict.mediaType?.movie : dict.mediaType?.show;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
        {/* Poster or Icon */}
        <div className="relative">
          {poster ? (
            <div className="relative w-32 h-48 rounded-lg overflow-hidden shadow-2xl">
              <Image
                src={poster}
                alt={title}
                fill
                className="object-cover"
              />
              {/* Status overlay */}
              {status?.status === ImportStatus.IMPORTING && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-32 h-48 rounded-lg bg-zinc-900 flex items-center justify-center">
              <Icon className="w-12 h-12 text-zinc-600" />
            </div>
          )}
          {/* Status badge */}
          {status?.status === ImportStatus.READY && (
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          )}
          {status?.status === ImportStatus.FAILED && (
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <XCircle className="w-6 h-6 text-white" />
            </div>
          )}
        </div>

        {/* Title and meta */}
        {title && (
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
            <p className="text-sm text-zinc-500">
              {typeLabel}
              {year && ` • ${year}`}
            </p>
          </div>
        )}

        {/* Status text */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-zinc-100">
            {status?.status === ImportStatus.IMPORTING && dict.import?.importing}
            {status?.status === ImportStatus.READY && dict.import?.ready}
            {status?.status === ImportStatus.FAILED && dict.import?.failed}
            {isLoading && dict.common.loading}
          </h1>
          <p className="text-sm text-zinc-400">
            {status?.status === ImportStatus.IMPORTING && dict.import?.importingHint}
            {status?.status === ImportStatus.READY && dict.import?.redirecting}
            {status?.status === ImportStatus.FAILED && dict.import?.failedHint}
          </p>
        </div>

        {/* Progress indicator */}
        {status?.status === ImportStatus.IMPORTING && (
          <div className="w-full max-w-xs">
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {/* Failed state - back button */}
        {status?.status === ImportStatus.FAILED && (
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
          >
            {dict.common.back}
          </button>
        )}
      </div>
    </div>
  );
}

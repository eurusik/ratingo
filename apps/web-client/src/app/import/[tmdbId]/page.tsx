'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Film, Tv, CheckCircle, XCircle } from 'lucide-react';

import { catalogApi } from '@/core/api/catalog';
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

  // Poll for import status every 2 seconds
  const { data: status, isLoading } = useQuery({
    queryKey: ['import-status', tmdbId],
    queryFn: () => catalogApi.checkImportStatus(tmdbId),
    enabled: tmdbId > 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when ready or failed
      if (data?.status === 'ready' || data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Redirect when import is complete
  useEffect(() => {
    if (status?.status === 'ready' && status.slug) {
      const path = status.type === 'movie' ? `/movies/${status.slug}` : `/shows/${status.slug}`;
      router.replace(path as any);
    }
  }, [status, router]);

  const Icon = type === 'movie' ? Film : Tv;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
        {/* Icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center">
            <Icon className="w-10 h-10 text-zinc-400" />
          </div>
          {status?.status === 'importing' && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-950 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            </div>
          )}
          {status?.status === 'ready' && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-950 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          )}
          {status?.status === 'failed' && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-950 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-zinc-100">
            {status?.status === 'importing' && dict.import?.importing}
            {status?.status === 'ready' && dict.import?.ready}
            {status?.status === 'failed' && dict.import?.failed}
            {isLoading && dict.common.loading}
          </h1>
          <p className="text-sm text-zinc-400">
            {status?.status === 'importing' && dict.import?.importingHint}
            {status?.status === 'ready' && dict.import?.redirecting}
            {status?.status === 'failed' && dict.import?.failedHint}
          </p>
        </div>

        {/* Skeleton cards */}
        {status?.status === 'importing' && (
          <div className="w-full space-y-3 mt-4">
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4 mx-auto" />
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2 mx-auto" />
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-2/3 mx-auto" />
          </div>
        )}

        {/* Failed state - back button */}
        {status?.status === 'failed' && (
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

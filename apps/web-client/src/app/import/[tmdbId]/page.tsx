'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';

import { catalogApi, ImportStatus } from '@/core/api/catalog';
import { useTranslation } from '@/shared/i18n';
import { DetailsSkeleton } from './details-skeleton';

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
  const { data: status } = useQuery({
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

  // Failed state
  if (status?.status === ImportStatus.FAILED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-zinc-100">{dict.import?.failed}</h1>
            <p className="text-sm text-zinc-400">{dict.import?.failedHint}</p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
          >
            {dict.common.back}
          </button>
        </div>
      </div>
    );
  }

  // Show details skeleton while importing
  return (
    <DetailsSkeleton
      title={title}
      poster={poster}
      year={year}
      type={type}
      statusMessage={dict.import?.importing || 'Додаємо...'}
      statusHint={dict.import?.importingHint || 'Збираємо інформацію з різних джерел'}
    />
  );
}

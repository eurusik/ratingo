'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';

import { catalogApi, ImportStatus, MediaType } from '@/core/api/catalog.client';
import { useTranslation } from '@/shared/i18n';
import { DetailsSkeleton } from './details-skeleton';

const POLL_INTERVAL = 2000;

interface ImportPageProps {
  params: Promise<{ tmdbId: string }>;
}

function useImportParams(params: ImportPageProps['params']) {
  const searchParams = useSearchParams();

  return {
    tmdbId: parseInt((params as any).tmdbId || '0', 10),
    type: (searchParams.get('type') as 'movie' | 'show') || 'movie',
    title: searchParams.get('title') || '',
    poster: searchParams.get('poster') || '',
    year: searchParams.get('year') || '',
    jobId: searchParams.get('jobId') || '',
    initialSlug: searchParams.get('slug') || '',
  };
}

function useJobPolling(jobId: string) {
  return useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => catalogApi.getJobStatus(jobId),
    enabled: !!jobId,
    retry: false, // Don't retry on 404 - job may be cleaned up
    refetchInterval: (query) => {
      // Stop polling on success, failure, or error (e.g., 404 job not found)
      if (query.state.error) return false;
      const status = query.state.data?.status;
      return status === 'ready' || status === 'failed' ? false : POLL_INTERVAL;
    },
  });
}

function ImportFailedView({ onBack }: { onBack: () => void }) {
  const { dict } = useTranslation();

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
          onClick={onBack}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
        >
          {dict.common.back}
        </button>
      </div>
    </div>
  );
}

export default function ImportPage({ params }: ImportPageProps) {
  const router = useRouter();
  const { dict } = useTranslation();
  const { tmdbId, type, title, poster, year, jobId, initialSlug } = useImportParams(params);
  const { data: jobStatus, isError: jobError } = useJobPolling(jobId);

  // When job polling fails (404 - job cleaned up), re-check media status via import endpoint
  const recheckMutation = useMutation({
    mutationFn: () =>
      type === 'movie' ? catalogApi.importMovie(tmdbId) : catalogApi.importShow(tmdbId),
  });

  // Trigger recheck when job polling fails
  useEffect(() => {
    if (jobError && !recheckMutation.isPending && !recheckMutation.data) {
      recheckMutation.mutate();
    }
  }, [jobError, recheckMutation]);

  // Determine final status from job polling or recheck
  const finalStatus = recheckMutation.data?.status || jobStatus?.status;
  const finalSlug = recheckMutation.data?.slug || jobStatus?.slug || initialSlug;

  const isReady = finalStatus === 'ready' || recheckMutation.data?.status === ImportStatus.READY;
  const isFailed =
    finalStatus === 'failed' ||
    recheckMutation.data?.status === ImportStatus.NOT_FOUND ||
    recheckMutation.isError;

  useEffect(() => {
    if (isReady && finalSlug) {
      router.replace(type === 'movie' ? `/movies/${finalSlug}` : `/shows/${finalSlug}`);
    }
  }, [isReady, finalSlug, type, router]);

  if (isFailed) {
    return <ImportFailedView onBack={() => router.back()} />;
  }

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

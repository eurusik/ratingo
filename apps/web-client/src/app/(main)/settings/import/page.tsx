'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { useAuth } from '@/core/auth';
import { Skeleton } from '@/shared/ui/skeleton';
import { SOURCE_PARSERS } from '@/modules/settings/utils/csv-parsers';
import { ImportWizard } from '@/modules/settings/components/import/import-wizard';
import type { ImportSource } from '@/modules/settings/components/import/import-source-step';

function ImportPageContent() {
  const { dict } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const sourceParam = searchParams.get('source') as ImportSource | null;
  const isValidSource = sourceParam && sourceParam in SOURCE_PARSERS;

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isValidSource) {
      router.replace('/settings?tab=data');
    }
  }, [isLoading, isAuthenticated, isValidSource, router]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-cinema-text-muted">{dict.auth.loginSubtitle}</p>
        <Link href="/settings" className="text-sm text-primary mt-4 hover:underline">
          {dict.common.back}
        </Link>
      </div>
    );
  }

  if (!isValidSource) return null;

  return <ImportWizard source={sourceParam} />;
}

export default function ImportPage() {
  const { dict } = useTranslation();
  const t = dict.settings.import;

  return (
    <div className="container max-w-xl mx-auto pt-24 pb-8 px-4">
      <Link
        href="/settings?tab=data"
        className="inline-flex items-center gap-1 text-sm text-cinema-text-muted hover:text-cinema-text-primary transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        {dict.settings.title}
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-cinema-text-primary">{t.title}</h1>
        <p className="text-cinema-text-muted mt-1">{t.subtitle}</p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <ImportPageContent />
      </Suspense>
    </div>
  );
}

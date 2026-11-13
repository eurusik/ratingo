'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';

export function TrendingError() {
  const { dict } = useTranslation();
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  return (
    <div role="alert" className="flex flex-col items-start gap-3 px-4 py-6 md:px-0">
      <p className="text-sm text-muted">{dict.home.trendingFailed}</p>
      <Button
        size="sm"
        variant="secondary"
        isPending={isRetrying}
        onPress={() => startRetry(() => router.refresh())}
      >
        {dict.common.retry}
      </Button>
    </div>
  );
}

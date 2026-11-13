'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';

export function DetailsError({ onRetry }: { onRetry: () => void }) {
  const { dict } = useTranslation();
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  const retry = () =>
    startRetry(() => {
      router.refresh();
      onRetry();
    });

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 pt-[max(6rem,var(--safe-top))] pb-16 text-center md:pt-24"
    >
      <h1 className="text-xl font-extrabold">{dict.details.error.title}</h1>
      <p className="text-sm text-muted">{dict.details.error.text}</p>
      <Button variant="secondary" isPending={isRetrying} onPress={retry}>
        {dict.common.retry}
      </Button>
    </div>
  );
}

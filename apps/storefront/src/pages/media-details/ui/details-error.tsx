'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@heroui/react';
import { BROWSE_ROUTE } from '@/shared/config';
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
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 pt-[max(6rem,var(--safe-top))] pb-16 text-center md:pt-24">
      <div role="alert" className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold">{dict.details.error.title}</h1>
        <p className="text-sm text-muted">{dict.details.error.text}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" isPending={isRetrying} onPress={retry}>
          {dict.common.retry}
        </Button>
        <Link href={BROWSE_ROUTE} className={buttonVariants({ variant: 'ghost' })}>
          {dict.details.breadcrumb.browse}
        </Link>
      </div>
    </div>
  );
}

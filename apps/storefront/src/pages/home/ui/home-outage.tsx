'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import { MY_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { useRefreshRetry } from '@/shared/lib';
import { ERROR_STATE_ACTION, ErrorState } from '@/shared/ui';

export function HomeOutage() {
  const { dict } = useTranslation();
  const { retry, isRetrying } = useRefreshRetry();
  const copy = dict.home.outage;

  return (
    <ErrorState
      icon={<TriangleAlert />}
      title={copy.title}
      text={copy.text}
      titleAs="h2"
      actions={
        <>
          <Button size="lg" className={ERROR_STATE_ACTION} isPending={isRetrying} onPress={retry}>
            {dict.common.retry}
          </Button>
          <Link
            href={MY_ROUTE}
            className={buttonVariants({
              variant: 'secondary',
              size: 'lg',
              className: ERROR_STATE_ACTION,
            })}
          >
            {copy.openMy}
          </Link>
        </>
      }
    />
  );
}

'use client';

import { Button } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import { MY_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { useRefreshRetry } from '@/shared/lib';
import { ERROR_STATE_ACTION, ErrorState, ErrorStateLink } from '@/shared/ui';

export function HomeOutage() {
  const { dict } = useTranslation();
  const { retry, isRetrying } = useRefreshRetry();
  const copy = dict.home.outage;

  return (
    <>
      <meta name="robots" content="noindex" />
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
            <ErrorStateLink href={MY_ROUTE}>{copy.openMy}</ErrorStateLink>
          </>
        }
      />
    </>
  );
}

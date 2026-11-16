'use client';

import { Button } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { errorDigest, useRetryTransition } from '@/shared/lib';
import { ERROR_STATE_ACTION, ErrorState, ErrorStateLink } from '@/shared/ui';
import { useHasBeenOffline } from '../model/use-has-been-offline';
import { ConnectionRecovery } from './connection-recovery';

interface PageLink {
  href: string;
  label: string;
}

interface PageErrorProps {
  title: string;
  text: string;
  error: unknown;
  onRetry: () => void;
  escape: PageLink;
}

export function PageError({ title, text, error, onRetry, escape }: PageErrorProps) {
  const { dict } = useTranslation();
  const { retry, isRetrying } = useRetryTransition(onRetry);
  const digest = errorDigest(error);
  const hasBeenOffline = useHasBeenOffline();
  const escapeLink = <ErrorStateLink href={escape.href}>{escape.label}</ErrorStateLink>;

  if (hasBeenOffline) return <ConnectionRecovery secondaryAction={escapeLink} />;

  return (
    <ErrorState
      icon={<TriangleAlert />}
      title={title}
      text={text}
      actions={
        <>
          <Button size="lg" className={ERROR_STATE_ACTION} isPending={isRetrying} onPress={retry}>
            {dict.common.retry}
          </Button>
          {escapeLink}
        </>
      }
      footnote={digest ? interpolate(dict.common.errorCode, { code: digest }) : undefined}
    />
  );
}

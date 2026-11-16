'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { errorDigest, useIsOffline, useRetryTransition } from '@/shared/lib';
import { ERROR_STATE_ACTION, ErrorState } from '@/shared/ui';
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

function useWasOffline(): boolean {
  const isOffline = useIsOffline();
  const [wasOffline, setWasOffline] = useState(isOffline);
  if (isOffline && !wasOffline) setWasOffline(true);
  return isOffline || wasOffline;
}

function EscapeLink({ escape }: { escape: PageLink }) {
  return (
    <Link
      href={escape.href}
      className={buttonVariants({ variant: 'secondary', size: 'lg', className: ERROR_STATE_ACTION })}
    >
      {escape.label}
    </Link>
  );
}

export function PageError({ title, text, error, onRetry, escape }: PageErrorProps) {
  const { dict } = useTranslation();
  const { retry, isRetrying } = useRetryTransition(onRetry);
  const digest = errorDigest(error);
  const wasOffline = useWasOffline();

  if (wasOffline) return <ConnectionRecovery secondaryAction={<EscapeLink escape={escape} />} />;

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
          <EscapeLink escape={escape} />
        </>
      }
      footnote={digest ? interpolate(dict.common.errorCode, { code: digest }) : undefined}
    />
  );
}

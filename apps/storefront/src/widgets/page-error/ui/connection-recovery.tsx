'use client';

import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import { ArrowLeft, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { ERROR_STATE_ACTION, ErrorState } from '@/shared/ui';
import { useHasBrowserHistory, useReloadWhenOnline } from '../model/use-connection-recovery';

function BackButton() {
  const { dict } = useTranslation();
  const hasHistory = useHasBrowserHistory();

  if (!hasHistory) return null;

  return (
    <Button
      variant="secondary"
      size="lg"
      className={ERROR_STATE_ACTION}
      onPress={() => window.history.back()}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {dict.offline.back}
    </Button>
  );
}

function SignalIcon({ reconnected }: { reconnected: boolean }) {
  if (reconnected) return <Wifi />;

  return (
    <>
      <span className="absolute inset-0 rounded-full border border-border motion-safe:animate-signal-ring" />
      <WifiOff />
    </>
  );
}

interface ConnectionRecoveryProps {
  secondaryAction?: ReactNode;
}

export function ConnectionRecovery({ secondaryAction = <BackButton /> }: ConnectionRecoveryProps) {
  const { dict } = useTranslation();
  const reconnected = useReloadWhenOnline();
  const text = dict.offline;

  return (
    <ErrorState
      tone={reconnected ? 'success' : 'neutral'}
      icon={<SignalIcon reconnected={reconnected} />}
      title={reconnected ? text.restoredTitle : text.title}
      text={reconnected ? text.restoredDescription : text.description}
      announce="status"
      actions={
        <div className="contents inert:invisible" inert={reconnected}>
          <Button
            size="lg"
            className={ERROR_STATE_ACTION}
            onPress={() => window.location.reload()}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {text.reload}
          </Button>
          {secondaryAction}
        </div>
      }
    />
  );
}

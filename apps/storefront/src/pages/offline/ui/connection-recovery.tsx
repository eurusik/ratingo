'use client';

import { Button } from '@heroui/react';
import { ArrowLeft, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { useHasBrowserHistory, useIsOnline } from '@/shared/lib';

function SignalIcon({ online }: { online: boolean }) {
  if (online) {
    return (
      <span className="flex size-16 items-center justify-center rounded-full bg-success-soft">
        <Wifi className="size-7 text-success" />
      </span>
    );
  }

  return (
    <span className="relative flex size-16 items-center justify-center rounded-full bg-surface">
      <span className="absolute inset-0 rounded-full border border-border motion-safe:animate-signal-ring" />
      <WifiOff className="size-7 text-muted" />
    </span>
  );
}

export function ConnectionRecovery() {
  const { dict } = useTranslation();
  const online = useIsOnline();
  const hasHistory = useHasBrowserHistory();
  const text = dict.offline;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span aria-hidden="true" className="mb-2">
        <SignalIcon online={online} />
      </span>
      <div role="status" className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {online ? text.restoredTitle : text.title}
        </h1>
        <p className="max-w-xs muted">{online ? text.restoredDescription : text.description}</p>
      </div>
      <div
        className="mt-3 flex flex-col items-center gap-1 md:flex-row md:gap-2 inert:invisible"
        inert={online}
      >
        <Button variant="secondary" size="lg" onPress={() => window.location.reload()}>
          <RefreshCw aria-hidden="true" className="size-4" />
          {text.reload}
        </Button>
        {hasHistory ? (
          <Button variant="ghost" size="lg" onPress={() => window.history.back()}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            {text.back}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

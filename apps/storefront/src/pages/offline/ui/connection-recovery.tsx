'use client';

import { Button } from '@heroui/react';
import { ArrowLeft, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { useHasBrowserHistory, useReloadWhenOnline } from '../model';

function SignalIcon({ reconnected }: { reconnected: boolean }) {
  if (reconnected) {
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
  const reconnected = useReloadWhenOnline();
  const hasHistory = useHasBrowserHistory();
  const text = dict.offline;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span aria-hidden="true" className="mb-2">
        <SignalIcon reconnected={reconnected} />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {reconnected ? text.restoredTitle : text.title}
      </h1>
      <p role="status" className="max-w-xs text-pretty muted">
        {reconnected ? text.restoredDescription : text.description}
      </p>
      <div
        className="mt-3 flex flex-col items-center gap-1 md:flex-row md:gap-2 inert:invisible"
        inert={reconnected}
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

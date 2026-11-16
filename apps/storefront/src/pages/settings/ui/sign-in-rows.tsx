'use client';

import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import { Mail } from 'lucide-react';
import type { LinkedAccount } from '@/shared/api';
import type { OAuthProvider } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ProviderMark } from '@/shared/ui';

const ROW_ACTION = 'phone-tap-target shrink-0 rounded-full md:h-10 md:px-4';

interface MethodRowProps {
  icon: ReactNode;
  name: string;
  status: ReactNode;
  action?: ReactNode;
}

function MethodRow({ icon, name, status, action }: MethodRowProps) {
  return (
    <div className="flex min-h-15 items-center gap-3 py-2.5 md:min-h-18 md:gap-3.5 md:py-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 md:size-10"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base">{name}</span>
        <span className="truncate text-[13px] text-muted md:text-sm">{status}</span>
      </span>
      {action}
    </div>
  );
}

interface ProviderRowProps {
  provider: OAuthProvider;
  account: LinkedAccount | undefined;
  isLinked: boolean;
  canDisconnect: boolean;
  lastMethodNoteId: string;
  isConnecting: boolean;
  isConnectBlocked: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ProviderRow({
  provider,
  account,
  isLinked,
  canDisconnect,
  lastMethodNoteId,
  isConnecting,
  isConnectBlocked,
  onConnect,
  onDisconnect,
}: ProviderRowProps) {
  const { dict } = useTranslation();
  const copy = dict.settings.security;
  const name = copy.methodNames[provider];
  const linkedStatus = account?.email
    ? interpolate(copy.connectedAs, { email: account.email })
    : copy.connected;

  return (
    <MethodRow
      icon={<ProviderMark provider={provider} />}
      name={name}
      status={isLinked ? linkedStatus : copy.notConnected}
      action={
        isLinked ? (
          <Button
            variant="outline"
            size="sm"
            className={ROW_ACTION}
            isDisabled={!canDisconnect}
            aria-describedby={canDisconnect ? undefined : lastMethodNoteId}
            aria-label={interpolate(copy.disconnectLabel, { provider: name })}
            onPress={onDisconnect}
          >
            {copy.disconnect}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className={ROW_ACTION}
            aria-label={interpolate(copy.connectLabel, { provider: name })}
            isPending={isConnecting}
            isDisabled={isConnectBlocked}
            onPress={onConnect}
          >
            {copy.connect}
          </Button>
        )
      }
    />
  );
}

interface EmailRowProps {
  email: string;
  hasPassword: boolean;
  isPasswordFormOpen: boolean;
  passwordFormId: string;
  onTogglePasswordForm: () => void;
}

export function EmailRow({
  email,
  hasPassword,
  isPasswordFormOpen,
  passwordFormId,
  onTogglePasswordForm,
}: EmailRowProps) {
  const { dict } = useTranslation();
  const copy = dict.settings.security;

  return (
    <MethodRow
      icon={<Mail className="size-4 md:size-[18px]" />}
      name={copy.emailMethod}
      status={hasPassword ? email : interpolate(copy.noPassword, { email })}
      action={
        hasPassword ? (
          <Button
            variant="outline"
            size="sm"
            className={ROW_ACTION}
            aria-expanded={isPasswordFormOpen}
            aria-controls={isPasswordFormOpen ? passwordFormId : undefined}
            onPress={onTogglePasswordForm}
          >
            {copy.changePassword}
          </Button>
        ) : null
      }
    />
  );
}

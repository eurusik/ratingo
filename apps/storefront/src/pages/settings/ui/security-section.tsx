'use client';

import { useId, useState, type ReactNode } from 'react';
import { Button, toast } from '@heroui/react';
import { Mail } from 'lucide-react';
import { ProviderMark, useEnabledOAuthProviders } from '@/features/authenticate';
import type { LinkedAccount } from '@/shared/api';
import type { OAuthProvider } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useAccount } from '../model/account';
import { useMethodNames } from '../model/method-names';
import {
  useLinkProvider,
  useLinkResultNotice,
  useLinkedAccounts,
  useUnlinkProvider,
} from '../model/sign-in';
import { canUnlink, listedProviders, methodsLeftAfterUnlink } from '../model/sign-in-methods';
import { PasswordForm } from './password-form';
import { CARD_LIST, SettingsGroup } from './settings-card';
import { UnlinkDialog } from './unlink-dialog';

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

function linkedStatus(
  account: LinkedAccount | undefined,
  copy: { connected: string; connectedAs: string },
) {
  return account?.email ? interpolate(copy.connectedAs, { email: account.email }) : copy.connected;
}

export function SecuritySection() {
  const { dict } = useTranslation();
  const copy = dict.settings.security;
  const user = useAccount();
  const formId = useId();
  const lastMethodId = useId();
  const enabled = useEnabledOAuthProviders();
  const linkedAccounts = useLinkedAccounts();
  const linkProvider = useLinkProvider();
  const unlink = useUnlinkProvider();
  const methodNames = useMethodNames();
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<OAuthProvider>('google');
  const [isUnlinkOpen, setIsUnlinkOpen] = useState(false);
  useLinkResultNotice();

  const isUnlinkAllowed = canUnlink(user);
  const accountOf = (provider: OAuthProvider) =>
    linkedAccounts.data?.find((account) => account.provider === provider);

  const askUnlink = (provider: OAuthProvider) => {
    setUnlinkTarget(provider);
    setIsUnlinkOpen(true);
  };

  const confirmUnlink = () => {
    const provider = copy.methodNames[unlinkTarget];
    unlink.mutate(unlinkTarget, {
      onSuccess: () => toast(interpolate(copy.unlinked, { provider })),
      onError: (error) => {
        console.error('Unlinking a sign-in provider failed', { provider: unlinkTarget, error });
        toast.danger(interpolate(copy.unlinkFailed, { provider }));
      },
      onSettled: () => setIsUnlinkOpen(false),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingsGroup titleId="settings-sign-in-methods" title={copy.methods}>
        <ul className={CARD_LIST}>
          {listedProviders(user, enabled).map((provider) => {
            const name = copy.methodNames[provider];
            const isLinked = user.linkedProviders.includes(provider);
            return (
              <li key={provider}>
                <MethodRow
                  icon={<ProviderMark provider={provider} />}
                  name={name}
                  status={isLinked ? linkedStatus(accountOf(provider), copy) : copy.notConnected}
                  action={
                    isLinked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className={ROW_ACTION}
                        isDisabled={!isUnlinkAllowed}
                        aria-describedby={isUnlinkAllowed ? undefined : lastMethodId}
                        aria-label={interpolate(copy.disconnectLabel, { provider: name })}
                        onPress={() => askUnlink(provider)}
                      >
                        {copy.disconnect}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className={ROW_ACTION}
                        aria-label={interpolate(copy.connectLabel, { provider: name })}
                        isPending={linkProvider.isPending && linkProvider.variables === provider}
                        isDisabled={linkProvider.isPending}
                        onPress={() => linkProvider.mutate(provider)}
                      >
                        {copy.connect}
                      </Button>
                    )
                  }
                />
              </li>
            );
          })}
          <li>
            <MethodRow
              icon={<Mail className="size-4 md:size-[18px]" />}
              name={copy.emailMethod}
              status={
                user.hasPassword ? user.email : interpolate(copy.noPassword, { email: user.email })
              }
              action={
                user.hasPassword ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className={ROW_ACTION}
                    aria-expanded={isPasswordOpen}
                    aria-controls={isPasswordOpen ? formId : undefined}
                    onPress={() => setIsPasswordOpen((isOpen) => !isOpen)}
                  >
                    {copy.changePassword}
                  </Button>
                ) : null
              }
            />
          </li>
        </ul>
        <p id={lastMethodId} className="mx-1 text-[13px] text-muted md:mx-0 md:text-sm">
          {copy.lastMethod}
        </p>
      </SettingsGroup>
      {isPasswordOpen ? (
        <PasswordForm id={formId} onClose={() => setIsPasswordOpen(false)} />
      ) : null}
      <UnlinkDialog
        isOpen={isUnlinkOpen}
        provider={copy.methodNames[unlinkTarget]}
        remaining={methodNames(methodsLeftAfterUnlink(user, unlinkTarget))}
        isPending={unlink.isPending}
        onCancel={() => setIsUnlinkOpen(false)}
        onConfirm={confirmUnlink}
      />
    </div>
  );
}

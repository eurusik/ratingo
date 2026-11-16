'use client';

import { useId, useState } from 'react';
import { toast } from '@heroui/react';
import { useEnabledOAuthProviders } from '@/features/authenticate';
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
import { EmailRow, ProviderRow } from './sign-in-rows';
import { UnlinkDialog } from './unlink-dialog';

function useUnlinkDialog() {
  const { dict } = useTranslation();
  const copy = dict.settings.security;
  const unlink = useUnlinkProvider();
  const [target, setTarget] = useState<OAuthProvider>('google');
  const [isOpen, setIsOpen] = useState(false);

  return {
    target,
    isOpen,
    isPending: unlink.isPending,
    ask: (provider: OAuthProvider) => {
      setTarget(provider);
      setIsOpen(true);
    },
    cancel: () => setIsOpen(false),
    confirm: () => {
      const provider = copy.methodNames[target];
      unlink.mutate(target, {
        onSuccess: () => toast(interpolate(copy.unlinked, { provider })),
        onError: (error) => {
          console.error('Unlinking a sign-in provider failed', { provider: target, error });
          toast.danger(interpolate(copy.unlinkFailed, { provider }));
        },
        onSettled: () => setIsOpen(false),
      });
    },
  };
}

export function SecuritySection() {
  const { dict } = useTranslation();
  const copy = dict.settings.security;
  const user = useAccount();
  const passwordFormId = useId();
  const lastMethodNoteId = useId();
  const enabled = useEnabledOAuthProviders();
  const linkedAccounts = useLinkedAccounts();
  const linkProvider = useLinkProvider();
  const unlinkDialog = useUnlinkDialog();
  const methodNames = useMethodNames();
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  useLinkResultNotice();

  const canDisconnect = canUnlink(user);

  return (
    <div className="flex flex-col gap-4">
      <SettingsGroup titleId="settings-sign-in-methods" title={copy.methods}>
        <ul className={CARD_LIST}>
          {listedProviders(user, enabled).map((provider) => (
            <li key={provider}>
              <ProviderRow
                provider={provider}
                account={linkedAccounts.data?.find((account) => account.provider === provider)}
                isLinked={user.linkedProviders.includes(provider)}
                canDisconnect={canDisconnect}
                lastMethodNoteId={lastMethodNoteId}
                isConnecting={linkProvider.isPending && linkProvider.variables === provider}
                isConnectBlocked={linkProvider.isPending}
                onConnect={() => linkProvider.mutate(provider)}
                onDisconnect={() => unlinkDialog.ask(provider)}
              />
            </li>
          ))}
          <li>
            <EmailRow
              email={user.email}
              hasPassword={user.hasPassword}
              isPasswordFormOpen={isPasswordFormOpen}
              passwordFormId={passwordFormId}
              onTogglePasswordForm={() => setIsPasswordFormOpen((isOpen) => !isOpen)}
            />
          </li>
        </ul>
        <p id={lastMethodNoteId} className="mx-1 text-[13px] text-muted md:mx-0 md:text-sm">
          {copy.lastMethod}
        </p>
      </SettingsGroup>
      {isPasswordFormOpen ? (
        <PasswordForm id={passwordFormId} onClose={() => setIsPasswordFormOpen(false)} />
      ) : null}
      <UnlinkDialog
        isOpen={unlinkDialog.isOpen}
        provider={copy.methodNames[unlinkDialog.target]}
        remaining={methodNames(methodsLeftAfterUnlink(user, unlinkDialog.target))}
        isPending={unlinkDialog.isPending}
        onCancel={unlinkDialog.cancel}
        onConfirm={unlinkDialog.confirm}
      />
    </div>
  );
}

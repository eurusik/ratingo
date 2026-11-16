'use client';

import { useRef, useState } from 'react';
import { toast } from '@heroui/react';
import type { MeDto } from '@ratingo/web-core/auth';
import { useTranslation } from '@/shared/i18n';
import { useAccount, useUpdateProfile } from './account';

type AccountToggle = keyof MeDto['profile']['privacy'];

export interface AccountToggles {
  valueOf: (toggle: AccountToggle) => boolean;
  set: (toggle: AccountToggle, value: boolean) => void;
}

type PendingValues = Partial<Record<AccountToggle, boolean>>;

function withoutToggle(values: PendingValues, toggle: AccountToggle): PendingValues {
  const next = { ...values };
  delete next[toggle];
  return next;
}

export function useAccountToggles(): AccountToggles {
  const { dict } = useTranslation();
  const user = useAccount();
  const update = useUpdateProfile();
  const [pending, setPending] = useState<PendingValues>({});
  const latestRequest = useRef<Partial<Record<AccountToggle, number>>>({});

  const set = (toggle: AccountToggle, value: boolean) => {
    const request = (latestRequest.current[toggle] ?? 0) + 1;
    latestRequest.current[toggle] = request;
    setPending((values) => ({ ...values, [toggle]: value }));
    update.mutate(
      { [toggle]: value },
      {
        onError: (error) => {
          console.error('Saving an account setting failed', { toggle, value, error });
          toast.danger(dict.settings.privacy.failed);
        },
        onSettled: () => {
          if (latestRequest.current[toggle] !== request) return;
          setPending((values) => withoutToggle(values, toggle));
        },
      },
    );
  };

  return {
    valueOf: (toggle) => pending[toggle] ?? user.profile.privacy[toggle],
    set,
  };
}

'use client';

import { useRef, useState } from 'react';
import { toast } from '@heroui/react';
import type { MeDto } from '@ratingo/web-core/auth';
import { useTranslation } from '@/shared/i18n';
import { useAccount, useUpdateProfile } from './account';

type AccountToggle = keyof MeDto['profile']['privacy'];

export interface AccountToggles {
  isOn: (toggle: AccountToggle) => boolean;
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
  const { mutateAsync } = useUpdateProfile();
  const [pending, setPending] = useState<PendingValues>({});
  const latestRequest = useRef<Partial<Record<AccountToggle, number>>>({});

  const save = async (toggle: AccountToggle, value: boolean, request: number) => {
    try {
      await mutateAsync({ [toggle]: value });
    } catch (error) {
      console.error('Saving an account setting failed', { toggle, value, error });
      toast.danger(dict.settings.privacy.failed);
    } finally {
      if (latestRequest.current[toggle] === request) {
        setPending((values) => withoutToggle(values, toggle));
      }
    }
  };

  return {
    isOn: (toggle) => pending[toggle] ?? user.profile.privacy[toggle],
    set: (toggle, value) => {
      const request = (latestRequest.current[toggle] ?? 0) + 1;
      latestRequest.current[toggle] = request;
      setPending((values) => ({ ...values, [toggle]: value }));
      void save(toggle, value, request);
    },
  };
}

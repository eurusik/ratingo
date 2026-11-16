'use client';

import { useEffect, useState } from 'react';
import { toast } from '@heroui/react';
import { ApiError, ErrorCode } from '@ratingo/web-core/api';
import { useTranslation } from '@/shared/i18n';
import { useAccount, useUpdateProfile } from './account';
import { changesOf, draftOf, hasChanges, type ProfileDraft } from './profile-draft';

function isUsernameTaken(error: unknown): boolean {
  return error instanceof ApiError && error.code === ErrorCode.USERNAME_ALREADY_EXISTS;
}

function useLeaveWarning(isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isActive]);
}

export interface ProfileForm {
  draft: ProfileDraft;
  change: <Field extends keyof ProfileDraft>(field: Field, value: ProfileDraft[Field]) => void;
  isDirty: boolean;
  isSaving: boolean;
  isUsernameTaken: boolean;
  reset: () => void;
  save: () => void;
}

export function useProfileForm(): ProfileForm {
  const { dict } = useTranslation();
  const copy = dict.settings.profile;
  const user = useAccount();
  const saved = draftOf(user);
  const [draft, setDraft] = useState(saved);
  const [takenUsername, setTakenUsername] = useState<string | null>(null);
  const update = useUpdateProfile();
  const isDirty = hasChanges(saved, draft);
  useLeaveWarning(isDirty);

  return {
    draft,
    change: (field, value) => setDraft((current) => ({ ...current, [field]: value })),
    isDirty,
    isSaving: update.isPending,
    isUsernameTaken: takenUsername !== null && takenUsername === draft.username.trim(),
    reset: () => {
      setDraft(saved);
      setTakenUsername(null);
    },
    save: () => {
      if (!isDirty || update.isPending) return;
      update.mutate(changesOf(saved, draft), {
        onSuccess: () => toast(copy.saved),
        onError: (error) => {
          if (isUsernameTaken(error)) {
            setTakenUsername(draft.username.trim());
            return;
          }
          console.error('Saving the profile failed', { error });
          toast.danger(copy.saveFailed);
        },
      });
    },
  };
}

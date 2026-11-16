'use client';

import { useState } from 'react';
import { toast } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { useAccount, useUpdateProfile } from './account';
import { changesOf, draftOf, hasChanges, type ProfileDraft } from './profile-draft';
import { useLeaveWarning } from './leave-guard';
import { usernameRejectionOf, type UsernameRejection } from './username-rejection';

interface RejectedUsername {
  username: string;
  reason: UsernameRejection;
}

export interface ProfileForm {
  draft: ProfileDraft;
  change: <Field extends keyof ProfileDraft>(field: Field, value: ProfileDraft[Field]) => void;
  isDirty: boolean;
  isSaving: boolean;
  usernameRejection: UsernameRejection | null;
  reset: () => void;
  save: () => void;
}

export function useProfileForm(): ProfileForm {
  const { dict } = useTranslation();
  const copy = dict.settings.profile;
  const user = useAccount();
  const [saved, setSaved] = useState(() => draftOf(user));
  const [draft, setDraft] = useState(saved);
  const [rejected, setRejected] = useState<RejectedUsername | null>(null);
  const update = useUpdateProfile();
  const isDirty = hasChanges(saved, draft);
  useLeaveWarning(isDirty);

  return {
    draft,
    change: (field, value) => setDraft((current) => ({ ...current, [field]: value })),
    isDirty,
    isSaving: update.isPending,
    usernameRejection:
      rejected && rejected.username === draft.username.trim() ? rejected.reason : null,
    reset: () => {
      setDraft(saved);
      setRejected(null);
    },
    save: () => {
      if (!isDirty || update.isPending) return;
      const submitted = draft;
      update.mutate(changesOf(saved, submitted), {
        onSuccess: () => {
          setSaved(submitted);
          toast(copy.saved);
        },
        onError: (error) => {
          const reason = usernameRejectionOf(error);
          if (reason) {
            setRejected({ username: submitted.username.trim(), reason });
            return;
          }
          console.error('Saving the profile failed', { error });
          toast.danger(copy.saveFailed);
        },
      });
    },
  };
}

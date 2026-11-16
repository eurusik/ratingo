'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { accountApi, type AvatarContentType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { showUndoToast } from '@/shared/lib';
import { useAccount } from './account';
import { avatarProblem, isAvatarType, type AvatarProblem } from './avatar-file';

async function uploadAvatar(file: File, contentType: AvatarContentType): Promise<string> {
  const { uploadUrl, publicUrl } = await accountApi.createAvatarUploadUrl(contentType);
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
  });
  if (!response.ok) throw new Error(`Avatar upload failed with status ${response.status}`);
  return publicUrl;
}

async function uploadChecked(file: File): Promise<string> {
  if (!isAvatarType(file.type)) throw new Error(`Unsupported avatar type ${file.type}`);
  return uploadAvatar(file, file.type);
}

export interface AvatarEditor {
  imageUrl: string | null;
  isBusy: boolean;
  change: (file: File) => void;
  remove: () => void;
}

export function useAvatarEditor(): AvatarEditor {
  const { dict } = useTranslation();
  const copy = dict.settings.profile;
  const user = useAccount();
  const { refreshUser } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const saveAvatar = useMutation({
    mutationFn: async (source: File | string | null) => {
      const avatarUrl = source instanceof File ? await uploadChecked(source) : source;
      await accountApi.updateProfile({ avatarUrl });
    },
    onSuccess: () => refreshUser(),
    onError: (error) => {
      console.error('Updating the avatar failed', { error });
      toast.danger(copy.photoFailed);
    },
  });

  const problemMessages: Record<AvatarProblem, string> = {
    type: copy.photoWrongType,
    size: copy.photoTooLarge,
  };

  const change = (file: File) => {
    if (saveAvatar.isPending) return;
    const problem = avatarProblem(file);
    if (problem) {
      toast.danger(problemMessages[problem]);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    saveAvatar.mutate(file, {
      onSuccess: () => toast(copy.photoUpdated),
      onSettled: () => {
        setPreviewUrl(null);
        URL.revokeObjectURL(objectUrl);
      },
    });
  };

  const remove = () => {
    const previous = user.avatarUrl;
    if (!previous || saveAvatar.isPending) return;
    saveAvatar.mutate(null, {
      onSuccess: () =>
        showUndoToast({
          key: 'settings-avatar',
          message: copy.photoRemoved,
          undoLabel: copy.undo,
          onUndo: () => saveAvatar.mutate(previous),
        }),
    });
  };

  return {
    imageUrl: previewUrl ?? user.avatarUrl,
    isBusy: saveAvatar.isPending,
    change,
    remove,
  };
}

'use client';

import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { isSaved, useLibraryStore } from '@/entities/library';
import { libraryApi, type MediaSaveStatus } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { planListChanges, toggledStatus } from './save-plan';

export interface SavableMedia {
  mediaItemId: string;
  title: string;
}

interface StatusChange {
  media: SavableMedia;
  from: MediaSaveStatus;
  to: MediaSaveStatus;
}

async function persist({ media, from, to }: StatusChange): Promise<MediaSaveStatus> {
  let status = to;
  for (const { list, action } of planListChanges(from, to)) {
    status =
      action === 'save'
        ? await libraryApi.save(media.mediaItemId, list)
        : await libraryApi.unsave(media.mediaItemId, list);
  }
  return status;
}

function keepOrSave(current: MediaSaveStatus): MediaSaveStatus {
  return isSaved(current) ? current : toggledStatus(current);
}

export function useLibrarySave() {
  const { dict } = useTranslation();
  const store = useLibraryStore();

  const { mutate } = useMutation({
    scope: { id: 'save-to-library' },
    mutationFn: persist,
    onMutate: ({ media, to }) => store.write(media.mediaItemId, to),
    onSuccess: (status, { media }) => store.write(media.mediaItemId, status),
    onError: (error, { media, from }) => {
      console.error('Updating the library failed', { mediaItemId: media.mediaItemId, error });
      store.write(media.mediaItemId, from);
      toast.danger(dict.saveToLibrary.toast.failed);
    },
  });

  const changeWithUndo = useCallback(
    (media: SavableMedia, next: (current: MediaSaveStatus) => MediaSaveStatus) => {
      const from = store.read(media.mediaItemId);
      const to = next(from);
      mutate({ media, from, to });

      const message = isSaved(to)
        ? dict.saveToLibrary.toast.saved
        : dict.saveToLibrary.toast.removed;
      const toastId = toast(interpolate(message, { title: media.title }), {
        actionProps: {
          children: dict.saveToLibrary.toast.undo,
          variant: 'tertiary',
          onPress: () => {
            toast.close(toastId);
            mutate({ media, from: store.read(media.mediaItemId), to: from });
          },
        },
      });
    },
    [dict, mutate, store],
  );

  const toggleSaved = useCallback(
    (media: SavableMedia) => changeWithUndo(media, toggledStatus),
    [changeWithUndo],
  );
  const save = useCallback(
    (media: SavableMedia) => changeWithUndo(media, keepOrSave),
    [changeWithUndo],
  );

  return { toggleSaved, save };
}

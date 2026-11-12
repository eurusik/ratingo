'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient, type Mutation } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { NOT_SAVED, isSaved, useLibraryStore } from '@/entities/library';
import { libraryApi, type MediaSaveStatus } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { planListChanges, toggledStatus } from './save-plan';
import { showUndoToast } from './undo-toast';

export interface SavableMedia {
  mediaItemId: string;
  title: string;
}

type NextStatus = (current: MediaSaveStatus) => MediaSaveStatus;

interface StatusChange {
  media: SavableMedia;
  next: NextStatus;
}

interface AppliedChange {
  before: MediaSaveStatus;
  after: MediaSaveStatus;
}

const SAVE_MUTATION_KEY = ['library', 'save'] as const;

async function applyChange({ media, next }: StatusChange): Promise<AppliedChange> {
  const statuses = await libraryApi.getSaveStatuses([media.mediaItemId]);
  const before = statuses[media.mediaItemId] ?? NOT_SAVED;
  let after = before;
  for (const { list, action } of planListChanges(before, next(before))) {
    after =
      action === 'save'
        ? await libraryApi.save(media.mediaItemId, list)
        : await libraryApi.unsave(media.mediaItemId, list);
  }
  return { before, after };
}

function keepOrSave(current: MediaSaveStatus): MediaSaveStatus {
  return isSaved(current) ? current : toggledStatus(current);
}

function changesMedia(mediaItemId: string) {
  return (mutation: Mutation<unknown, unknown, unknown>) =>
    (mutation.state.variables as StatusChange | undefined)?.media.mediaItemId === mediaItemId;
}

export function useLibrarySave() {
  const { dict } = useTranslation();
  const queryClient = useQueryClient();
  const store = useLibraryStore();

  const isLatestChange = useCallback(
    (mediaItemId: string) =>
      queryClient.isMutating({
        mutationKey: SAVE_MUTATION_KEY,
        predicate: changesMedia(mediaItemId),
      }) <= 1,
    [queryClient],
  );

  const { mutateAsync } = useMutation({
    mutationKey: SAVE_MUTATION_KEY,
    scope: { id: 'save-to-library' },
    mutationFn: applyChange,
    onMutate: ({ media, next }) =>
      store.write(media.mediaItemId, next(store.read(media.mediaItemId))),
    onSuccess: ({ after }, { media }) => {
      if (isLatestChange(media.mediaItemId)) store.write(media.mediaItemId, after);
    },
    onError: (error, { media }) => {
      console.error('Updating the library failed', { mediaItemId: media.mediaItemId, error });
      if (isLatestChange(media.mediaItemId)) store.refresh(media.mediaItemId);
      toast.danger(dict.saveToLibrary.toast.failed);
    },
  });

  const changeWithUndo = useCallback(
    (media: SavableMedia, next: NextStatus) => {
      const shown = store.read(media.mediaItemId);
      const applied = mutateAsync({ media, next }).catch(() => null);
      const message = isSaved(next(shown))
        ? dict.saveToLibrary.toast.saved
        : dict.saveToLibrary.toast.removed;

      showUndoToast({
        mediaItemId: media.mediaItemId,
        message: interpolate(message, { title: media.title }),
        undoLabel: dict.saveToLibrary.toast.undo,
        onUndo: () => {
          store.write(media.mediaItemId, shown);
          void applied.then((change) =>
            change ? mutateAsync({ media, next: () => change.before }).catch(() => null) : null,
          );
        },
      });
    },
    [dict, mutateAsync, store],
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

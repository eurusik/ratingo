'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient, type Mutation } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { LIBRARY_QUERY_KEY, NOT_SAVED, isSaved, useLibraryStore } from '@/entities/library';
import { libraryApi, type MediaSaveStatus } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ensureSaved, planListChanges } from './save-plan';
import { closeUndoToast, showUndoToast } from './undo-toast';

export interface SavableMedia {
  mediaItemId: string;
  title: string;
}

type SaveIntent =
  { kind: 'save' } | { kind: 'remove' } | { kind: 'restore'; previous: Promise<MediaSaveStatus> };

interface StatusChange {
  media: SavableMedia;
  intent: SaveIntent;
  optimistic: MediaSaveStatus;
}

interface AppliedChange {
  before: MediaSaveStatus;
  after: MediaSaveStatus;
}

const SAVE_MUTATION_KEY = [...LIBRARY_QUERY_KEY, 'save'] as const;

async function targetFor(intent: SaveIntent, before: MediaSaveStatus): Promise<MediaSaveStatus> {
  if (intent.kind === 'save') return ensureSaved(before);
  if (intent.kind === 'remove') return NOT_SAVED;
  return intent.previous;
}

async function applyChange({ media, intent }: StatusChange): Promise<AppliedChange> {
  const statuses = await libraryApi.getSaveStatuses([media.mediaItemId]);
  const before = statuses[media.mediaItemId] ?? NOT_SAVED;
  const target = await targetFor(intent, before);
  let after = before;
  for (const { list, action } of planListChanges(before, target)) {
    after =
      action === 'save'
        ? await libraryApi.save(media.mediaItemId, list)
        : await libraryApi.unsave(media.mediaItemId, list);
  }
  return { before, after };
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
    onMutate: ({ media, optimistic }) => store.write(media.mediaItemId, optimistic),
    onSuccess: ({ after }, { media }) => {
      if (isLatestChange(media.mediaItemId)) store.write(media.mediaItemId, after);
    },
    onError: (error, { media }) => {
      console.error('Updating the library failed', { mediaItemId: media.mediaItemId, error });
      closeUndoToast(media.mediaItemId);
      if (isLatestChange(media.mediaItemId)) store.refresh(media.mediaItemId);
      toast.danger(dict.saveToLibrary.toast.failed);
    },
  });

  const change = useCallback(
    (media: SavableMedia, intent: SaveIntent, optimistic: MediaSaveStatus) =>
      mutateAsync({ media, intent, optimistic }).catch(() => null),
    [mutateAsync],
  );

  const changeWithUndo = useCallback(
    (media: SavableMedia, intent: SaveIntent, toastMessage?: string) => {
      const shown = store.read(media.mediaItemId);
      const optimistic = intent.kind === 'remove' ? NOT_SAVED : ensureSaved(shown);
      const applied = change(media, intent, optimistic);
      const message = isSaved(optimistic)
        ? dict.saveToLibrary.toast.saved
        : dict.saveToLibrary.toast.removed;

      showUndoToast({
        mediaItemId: media.mediaItemId,
        message: toastMessage ?? interpolate(message, { title: media.title }),
        undoLabel: dict.saveToLibrary.toast.undo,
        onUndo: () => {
          const previous = applied.then((result) => result?.before ?? shown);
          void change(media, { kind: 'restore', previous }, shown);
        },
      });
    },
    [change, dict, store],
  );

  const toggleSaved = useCallback(
    (media: SavableMedia) =>
      changeWithUndo(media, {
        kind: isSaved(store.read(media.mediaItemId)) ? 'remove' : 'save',
      }),
    [changeWithUndo, store],
  );
  const save = useCallback(
    (media: SavableMedia) => changeWithUndo(media, { kind: 'save' }),
    [changeWithUndo],
  );

  const removeIfSaved = useCallback(
    (media: SavableMedia, message: string) => {
      if (isSaved(store.read(media.mediaItemId)))
        changeWithUndo(media, { kind: 'remove' }, message);
    },
    [changeWithUndo, store],
  );

  return { toggleSaved, save, removeIfSaved };
}

import { toast } from '@heroui/react';

const openToastByMedia = new Map<string, string>();

interface UndoToast {
  mediaItemId: string;
  message: string;
  undoLabel: string;
  onUndo: () => void;
}

export function showUndoToast({ mediaItemId, message, undoLabel, onUndo }: UndoToast): void {
  const previous = openToastByMedia.get(mediaItemId);
  if (previous) toast.close(previous);

  let isUndone = false;
  const toastId = toast(message, {
    actionProps: {
      children: undoLabel,
      variant: 'tertiary',
      onPress: () => {
        if (isUndone) return;
        isUndone = true;
        toast.close(toastId);
        onUndo();
      },
    },
    onClose: () => {
      if (openToastByMedia.get(mediaItemId) === toastId) openToastByMedia.delete(mediaItemId);
    },
  });
  openToastByMedia.set(mediaItemId, toastId);
}

export function closeUndoToast(mediaItemId: string): void {
  const toastId = openToastByMedia.get(mediaItemId);
  if (!toastId) return;
  toast.close(toastId);
  openToastByMedia.delete(mediaItemId);
}

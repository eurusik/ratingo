import type { ReactNode } from 'react';
import { toast } from '@heroui/react';
import { track } from '../analytics/track';

const openToastByKey = new Map<string, string>();

interface UndoToast {
  key: string;
  message: string;
  description?: ReactNode;
  undoLabel: string;
  onUndo: () => void;
  onKept?: () => void;
}

export function showUndoToast({
  key,
  message,
  description,
  undoLabel,
  onUndo,
  onKept,
}: UndoToast): void {
  const previous = openToastByKey.get(key);
  if (previous) toast.close(previous);

  let isUndone = false;
  const toastId = toast(message, {
    description,
    actionProps: {
      children: undoLabel,
      variant: 'tertiary',
      size: 'sm',
      onPress: () => {
        if (isUndone) return;
        isUndone = true;
        toast.close(toastId);
        track('undo', {});
        onUndo();
      },
    },
    onClose: () => {
      if (openToastByKey.get(key) === toastId) openToastByKey.delete(key);
      if (!isUndone) onKept?.();
    },
  });
  openToastByKey.set(key, toastId);
}

export function closeUndoToast(key: string): void {
  const toastId = openToastByKey.get(key);
  if (!toastId) return;
  toast.close(toastId);
  openToastByKey.delete(key);
}

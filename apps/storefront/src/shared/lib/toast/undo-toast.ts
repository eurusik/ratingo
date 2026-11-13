import { toast } from '@heroui/react';

const openToastByKey = new Map<string, string>();

interface UndoToast {
  key: string;
  message: string;
  undoLabel: string;
  onUndo: () => void;
}

export function showUndoToast({ key, message, undoLabel, onUndo }: UndoToast): void {
  const previous = openToastByKey.get(key);
  if (previous) toast.close(previous);

  let isUndone = false;
  const toastId = toast(message, {
    actionProps: {
      children: undoLabel,
      variant: 'tertiary',
      size: 'sm',
      onPress: () => {
        if (isUndone) return;
        isUndone = true;
        toast.close(toastId);
        onUndo();
      },
    },
    onClose: () => {
      if (openToastByKey.get(key) === toastId) openToastByKey.delete(key);
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

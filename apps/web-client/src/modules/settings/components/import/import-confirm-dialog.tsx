'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { formatNumber } from '../../utils/format-number';

interface ImportConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemCount: number;
  overwrite: boolean;
  labels: {
    title: string;
    message: string;
    overwriteWarning: string;
    confirm: string;
    cancel: string;
  };
}

export function ImportConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  itemCount,
  overwrite,
  labels,
}: ImportConfirmDialogProps) {
  const formattedCount = formatNumber(itemCount);
  const message = labels.message.replace('{count}', formattedCount);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{message}</p>
              {overwrite && (
                <p className="text-amber-500 dark:text-amber-400">{labels.overwriteWarning}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{labels.confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

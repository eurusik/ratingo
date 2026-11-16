'use client';

import { AlertDialog, Button } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';

interface OverwriteDialogProps {
  isOpen: boolean;
  sourceName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function OverwriteDialog({ isOpen, sourceName, onCancel, onConfirm }: OverwriteDialogProps) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.preview.confirm;

  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-sm">
          <AlertDialog.Header>
            <AlertDialog.Heading>{copy.title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="text-sm text-muted">{interpolate(copy.text, { source: sourceName })}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={onCancel} className="min-h-tap flex-1">
              {copy.cancel}
            </Button>
            <Button onPress={onConfirm} className="min-h-tap flex-1">
              {copy.submit}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

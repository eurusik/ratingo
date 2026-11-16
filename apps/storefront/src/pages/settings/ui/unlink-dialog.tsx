'use client';

import { AlertDialog, Button } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';

interface UnlinkDialogProps {
  isOpen: boolean;
  provider: string;
  remaining: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UnlinkDialog({
  isOpen,
  provider,
  remaining,
  isPending,
  onCancel,
  onConfirm,
}: UnlinkDialogProps) {
  const { dict } = useTranslation();
  const copy = dict.settings.security.unlink;

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
            <AlertDialog.Heading>{interpolate(copy.title, { provider })}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="text-sm text-muted">
              {interpolate(copy.text, { provider, rest: remaining })}
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={onCancel} className="min-h-tap flex-1">
              {copy.cancel}
            </Button>
            <Button
              variant="danger"
              isPending={isPending}
              onPress={onConfirm}
              className="min-h-tap flex-1"
            >
              {copy.confirm}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

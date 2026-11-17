'use client';

import { AlertDialog, Button } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';

interface DiscardDraftDialogProps {
  isOpen: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}

export function DiscardDraftDialog({ isOpen, onKeep, onDiscard }: DiscardDraftDialogProps) {
  const { dict } = useTranslation();
  const copy = dict.reviews.compose.discard;

  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onKeep();
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-sm">
          <AlertDialog.Header>
            <AlertDialog.Heading>{copy.title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="text-sm text-muted">{copy.text}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button autoFocus variant="tertiary" onPress={onKeep} className="min-h-tap flex-1">
              {copy.keep}
            </Button>
            <Button variant="danger" onPress={onDiscard} className="min-h-tap flex-1">
              {copy.confirm}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

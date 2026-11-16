'use client';

import { useState } from 'react';
import { Button, toast } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { useCancelImport } from '@/pages/settings/model/import/import-queries';
import { DiscardDialog } from '../discard-dialog';

export function StopButton({ batchIds }: { batchIds: readonly string[] }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.pending;
  const cancel = useCancelImport();
  const [isConfirming, setIsConfirming] = useState(false);

  const stop = () => {
    setIsConfirming(false);
    cancel.mutate(batchIds, {
      onError: (error) => {
        console.error('Stopping the import failed', { batchIds, error });
        toast.danger(copy.stopFailed);
      },
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        isPending={cancel.isPending}
        onPress={() => setIsConfirming(true)}
        className="h-11 rounded-full px-3.5 font-semibold md:h-9"
      >
        {copy.stop}
      </Button>
      <DiscardDialog
        copy={copy.stopConfirm}
        isOpen={isConfirming}
        onKeep={() => setIsConfirming(false)}
        onDiscard={stop}
      />
    </>
  );
}

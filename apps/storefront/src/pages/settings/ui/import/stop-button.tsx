'use client';

import { Button, toast } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { useCancelImport } from '@/pages/settings/model/import/import-queries';

export function StopButton({ batchIds }: { batchIds: readonly string[] }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.pending;
  const cancel = useCancelImport();

  return (
    <Button
      size="sm"
      variant="outline"
      isPending={cancel.isPending}
      onPress={() =>
        cancel.mutate(batchIds, {
          onError: (error) => {
            console.error('Stopping the import failed', { batchIds, error });
            toast.danger(copy.stopFailed);
          },
        })
      }
      className="h-11 rounded-full px-3.5 font-semibold md:h-9"
    >
      {copy.stop}
    </Button>
  );
}

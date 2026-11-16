'use client';

import { useState } from 'react';
import { toast } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { readImportFile, type ImportFile } from './import-file';
import type { ImportSource } from './import-sources';

interface FileReading {
  isReading: boolean;
  read: (
    files: readonly File[],
    source: ImportSource,
    onRead: (read: ImportFile[]) => void,
  ) => void;
}

export function useFileReading(): FileReading {
  const { dict } = useTranslation();
  const [pendingReads, setPendingReads] = useState(0);

  const read: FileReading['read'] = (files, source, onRead) => {
    if (files.length === 0) return;
    setPendingReads((count) => count + 1);
    Promise.all(files.map((file) => readImportFile(file, source)))
      .then(onRead)
      .catch((error: unknown) => {
        console.error('Reading import files failed', { source, error });
        toast.danger(dict.settings.import.files.readFailed);
      })
      .finally(() => setPendingReads((count) => count - 1));
  };

  return { isReading: pendingReads > 0, read };
}

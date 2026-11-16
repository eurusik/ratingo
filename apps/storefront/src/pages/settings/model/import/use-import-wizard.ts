'use client';

import { useReducer, useState } from 'react';
import { toast } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { readImportFile } from './import-file';
import { useImportMedia } from './import-queries';
import { MAX_IMPORT_ITEMS, summarizeImport } from './import-summary';
import type { ImportSource } from './import-sources';
import {
  INITIAL_IMPORT_STATE,
  hasImportableItems,
  importWizardReducer,
  type ImportWizardState,
  type PreviewFilter,
} from './import-wizard';
import type { LastImport } from './last-import';

export interface ImportWizard {
  state: ImportWizardState;
  canReview: boolean;
  isReading: boolean;
  pickSource: (source: ImportSource) => void;
  addFiles: (files: readonly File[]) => void;
  removeFile: (id: string) => void;
  back: () => void;
  review: () => void;
  setFilter: (filter: PreviewFilter) => void;
  setOverwrite: (overwrite: boolean) => void;
  submit: () => void;
  showSummary: (entry: LastImport) => void;
  restart: () => void;
}

export function useImportWizard(): ImportWizard {
  const { dict } = useTranslation();
  const [state, dispatch] = useReducer(importWizardReducer, INITIAL_IMPORT_STATE);
  const [pendingReads, setPendingReads] = useState(0);
  const importMedia = useImportMedia();

  const addFiles = (files: readonly File[]) => {
    const { source } = state;
    if (!source || files.length === 0) return;
    setPendingReads((count) => count + 1);
    Promise.all(files.map((file) => readImportFile(file, source)))
      .then((read) => dispatch({ type: 'addFiles', source, files: read }))
      .catch((error: unknown) => {
        console.error('Reading import files failed', { source, error });
        toast.danger(dict.settings.import.files.readFailed);
      })
      .finally(() => setPendingReads((count) => count - 1));
  };

  const submit = () => {
    const { source } = state;
    const { items } = summarizeImport(state.files);
    if (!source || state.step !== 'preview' || state.isImporting) return;
    if (items.length > MAX_IMPORT_ITEMS) return;
    dispatch({ type: 'importStarted' });
    importMedia.mutate(
      { source, items, overwrite: state.overwrite },
      {
        onSuccess: (result) =>
          dispatch({ type: 'importSucceeded', result, finishedAt: Date.now() }),
        onError: (error) => {
          console.error('Import failed', { source, count: items.length, error });
          dispatch({ type: 'importFailed' });
          toast.danger(dict.settings.import.preview.failed);
        },
      },
    );
  };

  return {
    state,
    canReview: hasImportableItems(state.files) && pendingReads === 0,
    isReading: pendingReads > 0,
    pickSource: (source) => dispatch({ type: 'pickSource', source }),
    addFiles,
    removeFile: (id) => dispatch({ type: 'removeFile', id }),
    back: () => dispatch({ type: 'back' }),
    review: () => dispatch({ type: 'review' }),
    setFilter: (filter) => dispatch({ type: 'filter', filter }),
    setOverwrite: (overwrite) => dispatch({ type: 'setOverwrite', overwrite }),
    submit,
    showSummary: ({ source, result, finishedAt }) =>
      dispatch({ type: 'showSummary', source, result, finishedAt }),
    restart: () => dispatch({ type: 'restart' }),
  };
}

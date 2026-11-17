'use client';

import { useReducer } from 'react';
import { toast } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { track } from '@/shared/lib';
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
import { useFileReading } from './use-file-reading';

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
  const reading = useFileReading();
  const importMedia = useImportMedia();

  const addFiles = (files: readonly File[]) => {
    const { source } = state;
    if (!source) return;
    reading.read(files, source, (read) => dispatch({ type: 'addFiles', source, files: read }));
  };

  const submit = () => {
    const { source } = state;
    const { items } = summarizeImport(state.files);
    if (!source || state.step !== 'preview' || state.isImporting) return;
    if (items.length > MAX_IMPORT_ITEMS) return;
    dispatch({ type: 'importStarted' });
    track('library_import', { stage: 'start', source, items: items.length });
    importMedia.mutate(
      { source, items, overwrite: state.overwrite },
      {
        onSuccess: (result) => {
          track('library_import', { stage: 'success', source, items: items.length });
          dispatch({ type: 'importSucceeded', result, finishedAt: Date.now() });
        },
        onError: (error) => {
          console.error('Import failed', { source, count: items.length, error });
          track('library_import', { stage: 'failed', source, items: items.length });
          dispatch({ type: 'importFailed' });
          toast.danger(dict.settings.import.preview.failed);
        },
      },
    );
  };

  return {
    state,
    canReview: hasImportableItems(state.files) && !reading.isReading,
    isReading: reading.isReading,
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

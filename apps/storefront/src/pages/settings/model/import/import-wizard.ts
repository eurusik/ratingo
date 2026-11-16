import type { MediaImportResult } from '@/shared/api';
import type { ImportFile } from './import-file';
import type { ImportSource } from './import-sources';

export type ImportStep = 'source' | 'files' | 'preview' | 'result';
export type PreviewFilter = 'all' | 'ratings' | 'watchlist';

export interface ImportWizardState {
  step: ImportStep;
  source?: ImportSource;
  files: ImportFile[];
  filter: PreviewFilter;
  overwrite: boolean;
  isImporting: boolean;
  result?: MediaImportResult;
  finishedAt?: number;
}

export type ImportWizardAction =
  | { type: 'pickSource'; source: ImportSource }
  | { type: 'addFiles'; source: ImportSource; files: ImportFile[] }
  | { type: 'removeFile'; id: string }
  | { type: 'back' }
  | { type: 'review' }
  | { type: 'filter'; filter: PreviewFilter }
  | { type: 'setOverwrite'; overwrite: boolean }
  | { type: 'importStarted' }
  | { type: 'importSucceeded'; result: MediaImportResult; finishedAt: number }
  | { type: 'importFailed' }
  | { type: 'showSummary'; source: ImportSource; result: MediaImportResult; finishedAt: number }
  | { type: 'restart' };

export const INITIAL_IMPORT_STATE: ImportWizardState = {
  step: 'source',
  files: [],
  filter: 'all',
  overwrite: false,
  isImporting: false,
};

const PREVIOUS_STEP: Partial<Record<ImportStep, ImportStep>> = {
  files: 'source',
  preview: 'files',
};

export function hasImportableItems(files: readonly ImportFile[]): boolean {
  return files.some((file) => file.status === 'ready');
}

function addFiles(current: readonly ImportFile[], added: readonly ImportFile[]): ImportFile[] {
  const addedIds = new Set(added.map((file) => file.id));
  return [...current.filter((file) => !addedIds.has(file.id)), ...added];
}

export function importWizardReducer(
  state: ImportWizardState,
  action: ImportWizardAction,
): ImportWizardState {
  switch (action.type) {
    case 'pickSource':
      if (state.isImporting) return state;
      return {
        ...state,
        step: 'files',
        source: action.source,
        files: action.source === state.source ? state.files : [],
        filter: 'all',
      };
    case 'addFiles':
      if (action.source !== state.source || state.step !== 'files') return state;
      return { ...state, files: addFiles(state.files, action.files) };
    case 'removeFile':
      return { ...state, files: state.files.filter((file) => file.id !== action.id) };
    case 'back': {
      const previous = PREVIOUS_STEP[state.step];
      if (!previous || state.isImporting) return state;
      return { ...state, step: previous };
    }
    case 'review':
      if (state.step !== 'files' || !hasImportableItems(state.files)) return state;
      return { ...state, step: 'preview', filter: 'all' };
    case 'filter':
      return { ...state, filter: action.filter };
    case 'setOverwrite':
      return { ...state, overwrite: action.overwrite };
    case 'importStarted':
      if (state.step !== 'preview' || state.isImporting) return state;
      return { ...state, isImporting: true };
    case 'importSucceeded':
      if (!state.isImporting) return state;
      return {
        ...state,
        step: 'result',
        isImporting: false,
        result: action.result,
        finishedAt: action.finishedAt,
      };
    case 'importFailed':
      return { ...state, isImporting: false };
    case 'showSummary':
      if (state.isImporting) return state;
      return {
        ...INITIAL_IMPORT_STATE,
        step: 'result',
        source: action.source,
        result: action.result,
        finishedAt: action.finishedAt,
      };
    case 'restart':
      return state.isImporting ? state : INITIAL_IMPORT_STATE;
  }
}

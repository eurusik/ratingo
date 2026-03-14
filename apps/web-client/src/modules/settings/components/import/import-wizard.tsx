'use client';

import { useReducer, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/shared/i18n';
import { SOURCE_PARSERS, type ParsedItem } from '../../utils/csv-parsers';
import { useImportMedia, type ImportResult, type ImportRequest } from '../../hooks/use-import-media';
import { FILE_TOO_LARGE_SENTINEL } from './import-dropzone';
import { ImportStepper } from './import-stepper';
import type { ImportSource } from './import-source-step';
import { ImportUploadStep } from './import-upload-step';
import { ImportPreviewStep } from './import-preview-step';
import { ImportResultSummary } from './import-result-summary';
import type { FileState } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 'upload' | 'preview' | 'result';

interface WizardState {
  step: WizardStep;
  ratingsFile: FileState;
  watchlistFile: FileState;
  ratings: ParsedItem[];
  watchlist: ParsedItem[];
  overwrite: boolean;
  isImporting: boolean;
  previewFilter: 'all' | 'ratings' | 'watchlist';
  response: ImportResult | null;
}

type WizardAction =
  | { type: 'BACK' }
  | { type: 'ADD_RATINGS'; items: ParsedItem[]; skippedRows: number; fileName: string }
  | { type: 'CLEAR_RATINGS' }
  | { type: 'RATINGS_ERROR'; errorMessage: string; fileName: string }
  | { type: 'ADD_WATCHLIST'; items: ParsedItem[]; skippedRows: number; fileName: string }
  | { type: 'CLEAR_WATCHLIST' }
  | { type: 'WATCHLIST_ERROR'; errorMessage: string; fileName: string }
  | { type: 'TOGGLE_OVERWRITE' }
  | { type: 'PROCEED_TO_PREVIEW' }
  | { type: 'SET_PREVIEW_FILTER'; filter: 'all' | 'ratings' | 'watchlist' }
  | { type: 'IMPORT_START' }
  | { type: 'IMPORT_DONE'; response: ImportResult }
  | { type: 'IMPORT_ERROR' }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEMPLATE_PLACEHOLDER_TYPE = '{type}';
const SETTINGS_DATA_URL = '/settings?tab=data';

const INITIAL_FILE_STATE: FileState = { status: 'idle' };

const INITIAL_STATE: WizardState = {
  step: 'upload',
  ratingsFile: INITIAL_FILE_STATE,
  watchlistFile: INITIAL_FILE_STATE,
  ratings: [],
  watchlist: [],
  overwrite: false,
  isImporting: false,
  previewFilter: 'all',
  response: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'BACK': {
      if (state.step === 'preview') return { ...state, step: 'upload', isImporting: false };
      return state;
    }

    case 'ADD_RATINGS':
      return {
        ...state,
        ratingsFile: {
          status: 'loaded',
          fileName: action.fileName,
          itemCount: action.items.length,
          skippedCount: action.skippedRows,
        },
        ratings: action.items,
      };

    case 'RATINGS_ERROR':
      return {
        ...state,
        ratingsFile: { status: 'error', fileName: action.fileName, errorMessage: action.errorMessage },
        ratings: [],
      };

    case 'CLEAR_RATINGS':
      return { ...state, ratingsFile: INITIAL_FILE_STATE, ratings: [] };

    case 'ADD_WATCHLIST':
      return {
        ...state,
        watchlistFile: {
          status: 'loaded',
          fileName: action.fileName,
          itemCount: action.items.length,
          skippedCount: action.skippedRows,
        },
        watchlist: action.items,
      };

    case 'WATCHLIST_ERROR':
      return {
        ...state,
        watchlistFile: { status: 'error', fileName: action.fileName, errorMessage: action.errorMessage },
        watchlist: [],
      };

    case 'CLEAR_WATCHLIST':
      return { ...state, watchlistFile: INITIAL_FILE_STATE, watchlist: [] };

    case 'TOGGLE_OVERWRITE':
      return { ...state, overwrite: !state.overwrite };

    case 'PROCEED_TO_PREVIEW':
      if (state.ratings.length === 0 && state.watchlist.length === 0) return state;
      return { ...state, step: 'preview' };

    case 'SET_PREVIEW_FILTER':
      return { ...state, previewFilter: action.filter };

    case 'IMPORT_START':
      if (state.step !== 'preview') return state;
      return { ...state, isImporting: true };

    case 'IMPORT_DONE':
      if (!state.isImporting) return state;
      return { ...state, step: 'result', isImporting: false, response: action.response };

    case 'IMPORT_ERROR':
      return { ...state, isImporting: false };

    case 'RESET':
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ImportWizardProps {
  source: ImportSource;
}

export function ImportWizard({ source }: ImportWizardProps) {
  const { dict } = useTranslation();
  const t = dict.settings.import;
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const importMutation = useImportMedia();

  // --- File processing (source-aware) ---
  const processFile = useCallback(
    async (text: string, fileName: string, slot: 'ratings' | 'watchlist') => {
      const errorType = slot === 'ratings' ? 'RATINGS_ERROR' : 'WATCHLIST_ERROR';
      const dispatchError = (errorMessage: string) =>
        dispatch({ type: errorType, errorMessage, fileName });

      if (text === FILE_TOO_LARGE_SENTINEL) return dispatchError(t.errors.fileTooLarge);
      if (!text) return dispatchError(t.errors.onlyCsv);

      const parser = SOURCE_PARSERS[source];
      if (!parser) return dispatchError(t.errors.wrongFile);

      try {
        const detectedType = parser.detectFileType(text);

        if (detectedType === 'unknown') return dispatchError(t.errors.wrongFile);
        if (detectedType === 'watchlist' && slot === 'ratings')
          return dispatchError(t.errors.wrongSlot.replace(TEMPLATE_PLACEHOLDER_TYPE, t.typeWatchlist));
        if (detectedType === 'ratings' && slot === 'watchlist')
          return dispatchError(t.errors.wrongSlot.replace(TEMPLATE_PLACEHOLDER_TYPE, t.typeRating));

        const { items, skippedRows } = await (slot === 'ratings'
          ? parser.parseRatings(text)
          : parser.parseWatchlist(text));

        dispatch({
          type: slot === 'ratings' ? 'ADD_RATINGS' : 'ADD_WATCHLIST',
          items,
          skippedRows,
          fileName,
        });
      } catch (err) {
        dispatchError(err instanceof Error ? err.message : t.errors.wrongFile);
      }
    },
    [t, source],
  );

  const handleRatingsFile = useCallback(
    (text: string, fileName: string) => processFile(text, fileName, 'ratings'),
    [processFile],
  );

  const handleWatchlistFile = useCallback(
    (text: string, fileName: string) => processFile(text, fileName, 'watchlist'),
    [processFile],
  );

  // --- Navigation helpers ---
  const handleBackToSettings = () => router.push(SETTINGS_DATA_URL);

  // --- Import ---
  const handleImport = async () => {
    if (state.step !== 'preview' || state.isImporting || importMutation.isPending) return;

    dispatch({ type: 'IMPORT_START' });

    const allItems = [...state.ratings, ...state.watchlist];

    try {
      const response = await importMutation.mutateAsync({
        source: source as ImportRequest['source'],
        items: allItems.map((item) => ({
          imdbId: item.imdbId,
          tmdbId: item.tmdbId,
          rating: item.rating,
          state: item.state,
          title: item.title,
          year: item.year,
        })),
        overwriteExisting: state.overwrite,
      });
      dispatch({ type: 'IMPORT_DONE', response });
    } catch {
      dispatch({ type: 'IMPORT_ERROR' });
    }
  };

  // --- Render ---
  return (
    <div className="space-y-6">
      <ImportStepper
        currentStep={state.step}
        labels={t.steps}
      />

      {state.step === 'upload' && (
        <ImportUploadStep
          ratingsFile={state.ratingsFile}
          watchlistFile={state.watchlistFile}
          isUploading={false}
          hasItems={state.ratings.length > 0 || state.watchlist.length > 0}
          onRatingsFile={handleRatingsFile}
          onWatchlistFile={handleWatchlistFile}
          onClearRatings={() => dispatch({ type: 'CLEAR_RATINGS' })}
          onClearWatchlist={() => dispatch({ type: 'CLEAR_WATCHLIST' })}
          onBack={handleBackToSettings}
          onContinue={() => dispatch({ type: 'PROCEED_TO_PREVIEW' })}
          labels={{
            ratingsFile: t.ratingsFile,
            watchlistFile: t.watchlistFile,
            dropHint: t.dropHint,
            dragOver: t.dragOver,
            recognized: t.recognized,
            skippedRows: t.skippedRows,
            clearFile: t.clearFile,
            retryFile: t.retryFile,
            maxSizeHint: t.maxSizeHint,
            howTo: t.howTo,
            howToSteps: t.howToSteps,
            back: t.back,
            continue: t.continue,
          }}
        />
      )}

      {state.step === 'preview' && (
        <ImportPreviewStep
          ratings={state.ratings}
          watchlist={state.watchlist}
          ratingsSkippedCount={state.ratingsFile.skippedCount ?? 0}
          watchlistSkippedCount={state.watchlistFile.skippedCount ?? 0}
          overwrite={state.overwrite}
          isImporting={state.isImporting}
          previewFilter={state.previewFilter}
          onFilterChange={(filter) =>
            dispatch({ type: 'SET_PREVIEW_FILTER', filter: filter as 'all' | 'ratings' | 'watchlist' })
          }
          onToggleOverwrite={() => dispatch({ type: 'TOGGLE_OVERWRITE' })}
          onBack={() => dispatch({ type: 'BACK' })}
          onImport={handleImport}
          labels={{
            back: t.back,
            summary: t.previewSummary,
            truncated: t.truncated,
            rating: t.typeRating,
            watchlist: t.typeWatchlist,
            colTitle: t.colTitle,
            colYear: t.colYear,
            colType: t.colType,
            colRating: t.colRating,
            filterAll: t.filterAll,
            filterRatings: t.filterRatings,
            filterWatchlist: t.filterWatchlist,
            skippedExplanation: t.skippedExplanation,
            overwrite: t.overwrite,
            overwriteHint: t.overwriteHint,
            importButton: t.importButton,
            importing: t.importing,
            confirmImport: t.confirmImport,
          }}
        />
      )}

      {state.step === 'result' && state.response && (
        <ImportResultSummary
          result={state.response}
          onImportMore={handleBackToSettings}
          doneLabel={t.done}
          importedLabel={t.imported}
          skippedLabel={t.skipped}
          notFoundLabel={t.notFound}
          goToRatingsLabel={t.goToRatings}
          importMoreLabel={t.importMore}
          pendingLabels={t.pending}
        />
      )}
    </div>
  );
}

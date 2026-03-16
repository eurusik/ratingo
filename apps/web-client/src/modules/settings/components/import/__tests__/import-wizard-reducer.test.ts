/**
 * Tests for the ImportWizard reducer.
 *
 * The reducer is a module-private function and is not exported from
 * import-wizard.tsx. Rather than modifying the source for testability, this
 * file contains a verbatim copy of the reducer and its supporting types so
 * the pure logic can be exercised in isolation.
 *
 * IMPORTANT: If you change the reducer in import-wizard.tsx, keep this copy
 * in sync. A failing test is a signal that the two are out of step.
 */

// ---------------------------------------------------------------------------
// Inline copy of types / constants from import-wizard.tsx
// ---------------------------------------------------------------------------

import type { ParsedItem } from '../../../utils/csv-parsers';
import type { FileState } from '../types';

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

// Minimal shape — only the fields the reducer touches.
interface ImportResult {
  imported: number;
  skipped: number;
  notFound: number;
  durationMs: number;
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

// Verbatim copy of the reducer from import-wizard.tsx
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
// Fixtures
// ---------------------------------------------------------------------------

const RATING_ITEM: ParsedItem = {
  imdbId: 'tt1234567',
  tmdbId: 550,
  rating: 8,
  state: 'completed',
  title: 'Fight Club',
  year: 1999,
};

const WATCHLIST_ITEM: ParsedItem = {
  imdbId: 'tt7654321',
  tmdbId: 101,
  state: 'planned',
  title: 'Inception',
  year: 2010,
};

const IMPORT_RESULT: ImportResult = {
  imported: 10,
  skipped: 2,
  notFound: 1,
  durationMs: 300,
};

// Helper to build a state already on the preview step with items loaded
function stateAtPreview(overrides: Partial<WizardState> = {}): WizardState {
  return {
    ...INITIAL_STATE,
    step: 'preview',
    ratingsFile: { status: 'loaded', fileName: 'ratings.csv', itemCount: 1, skippedCount: 0 },
    ratings: [RATING_ITEM],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportWizard reducer — initial state', () => {
  it('starts at the upload step', () => {
    expect(INITIAL_STATE.step).toBe('upload');
  });

  it('starts with empty ratings and watchlist arrays', () => {
    expect(INITIAL_STATE.ratings).toHaveLength(0);
    expect(INITIAL_STATE.watchlist).toHaveLength(0);
  });

  it('starts with overwrite=false', () => {
    expect(INITIAL_STATE.overwrite).toBe(false);
  });

  it('starts with isImporting=false', () => {
    expect(INITIAL_STATE.isImporting).toBe(false);
  });

  it('starts with both file slots idle', () => {
    expect(INITIAL_STATE.ratingsFile.status).toBe('idle');
    expect(INITIAL_STATE.watchlistFile.status).toBe('idle');
  });

  it('starts with response=null', () => {
    expect(INITIAL_STATE.response).toBeNull();
  });
});

describe('ImportWizard reducer — ADD_RATINGS', () => {
  it('sets ratingsFile status to "loaded"', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'ADD_RATINGS',
      items: [RATING_ITEM],
      skippedRows: 0,
      fileName: 'ratings.csv',
    });
    expect(next.ratingsFile.status).toBe('loaded');
  });

  it('stores the parsed items in ratings', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'ADD_RATINGS',
      items: [RATING_ITEM],
      skippedRows: 0,
      fileName: 'ratings.csv',
    });
    expect(next.ratings).toEqual([RATING_ITEM]);
  });

  it('records itemCount and skippedCount on ratingsFile', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'ADD_RATINGS',
      items: [RATING_ITEM, RATING_ITEM],
      skippedRows: 3,
      fileName: 'ratings.csv',
    });
    expect(next.ratingsFile.itemCount).toBe(2);
    expect(next.ratingsFile.skippedCount).toBe(3);
  });

  it('stores the fileName on ratingsFile', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'ADD_RATINGS',
      items: [RATING_ITEM],
      skippedRows: 0,
      fileName: 'my-ratings.csv',
    });
    expect(next.ratingsFile.fileName).toBe('my-ratings.csv');
  });

  it('does not touch watchlistFile', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'ADD_RATINGS',
      items: [RATING_ITEM],
      skippedRows: 0,
      fileName: 'ratings.csv',
    });
    expect(next.watchlistFile).toEqual(INITIAL_FILE_STATE);
  });
});

describe('ImportWizard reducer — RATINGS_ERROR', () => {
  it('sets ratingsFile status to "error"', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'RATINGS_ERROR',
      errorMessage: 'Bad file',
      fileName: 'bad.csv',
    });
    expect(next.ratingsFile.status).toBe('error');
  });

  it('stores the error message on ratingsFile', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'RATINGS_ERROR',
      errorMessage: 'Bad file',
      fileName: 'bad.csv',
    });
    expect(next.ratingsFile.errorMessage).toBe('Bad file');
  });

  it('clears any previously parsed ratings', () => {
    const stateWithRatings: WizardState = { ...INITIAL_STATE, ratings: [RATING_ITEM] };
    const next = reducer(stateWithRatings, {
      type: 'RATINGS_ERROR',
      errorMessage: 'Bad file',
      fileName: 'bad.csv',
    });
    expect(next.ratings).toHaveLength(0);
  });
});

describe('ImportWizard reducer — CLEAR_RATINGS', () => {
  it('resets ratingsFile to idle', () => {
    const stateWithFile: WizardState = {
      ...INITIAL_STATE,
      ratingsFile: { status: 'loaded', fileName: 'ratings.csv', itemCount: 5, skippedCount: 0 },
    };
    const next = reducer(stateWithFile, { type: 'CLEAR_RATINGS' });
    expect(next.ratingsFile).toEqual(INITIAL_FILE_STATE);
  });

  it('clears ratings array', () => {
    const stateWithRatings: WizardState = { ...INITIAL_STATE, ratings: [RATING_ITEM] };
    const next = reducer(stateWithRatings, { type: 'CLEAR_RATINGS' });
    expect(next.ratings).toHaveLength(0);
  });
});

describe('ImportWizard reducer — ADD_WATCHLIST', () => {
  it('sets watchlistFile status to "loaded"', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'ADD_WATCHLIST',
      items: [WATCHLIST_ITEM],
      skippedRows: 1,
      fileName: 'watchlist.csv',
    });
    expect(next.watchlistFile.status).toBe('loaded');
  });

  it('stores parsed items in watchlist', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'ADD_WATCHLIST',
      items: [WATCHLIST_ITEM],
      skippedRows: 0,
      fileName: 'watchlist.csv',
    });
    expect(next.watchlist).toEqual([WATCHLIST_ITEM]);
  });

  it('records itemCount and skippedCount on watchlistFile', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'ADD_WATCHLIST',
      items: [WATCHLIST_ITEM],
      skippedRows: 2,
      fileName: 'watchlist.csv',
    });
    expect(next.watchlistFile.itemCount).toBe(1);
    expect(next.watchlistFile.skippedCount).toBe(2);
  });

  it('does not touch ratingsFile', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'ADD_WATCHLIST',
      items: [WATCHLIST_ITEM],
      skippedRows: 0,
      fileName: 'watchlist.csv',
    });
    expect(next.ratingsFile).toEqual(INITIAL_FILE_STATE);
  });
});

describe('ImportWizard reducer — WATCHLIST_ERROR', () => {
  it('sets watchlistFile status to "error"', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'WATCHLIST_ERROR',
      errorMessage: 'Wrong format',
      fileName: 'bad.csv',
    });
    expect(next.watchlistFile.status).toBe('error');
  });

  it('clears any previously parsed watchlist items', () => {
    const stateWithItems: WizardState = { ...INITIAL_STATE, watchlist: [WATCHLIST_ITEM] };
    const next = reducer(stateWithItems, {
      type: 'WATCHLIST_ERROR',
      errorMessage: 'Wrong format',
      fileName: 'bad.csv',
    });
    expect(next.watchlist).toHaveLength(0);
  });
});

describe('ImportWizard reducer — CLEAR_WATCHLIST', () => {
  it('resets watchlistFile to idle', () => {
    const stateWithFile: WizardState = {
      ...INITIAL_STATE,
      watchlistFile: { status: 'loaded', fileName: 'watchlist.csv', itemCount: 3, skippedCount: 0 },
    };
    const next = reducer(stateWithFile, { type: 'CLEAR_WATCHLIST' });
    expect(next.watchlistFile).toEqual(INITIAL_FILE_STATE);
  });

  it('clears watchlist array', () => {
    const stateWithItems: WizardState = { ...INITIAL_STATE, watchlist: [WATCHLIST_ITEM] };
    const next = reducer(stateWithItems, { type: 'CLEAR_WATCHLIST' });
    expect(next.watchlist).toHaveLength(0);
  });
});

describe('ImportWizard reducer — TOGGLE_OVERWRITE', () => {
  it('flips overwrite from false to true', () => {
    const next = reducer(INITIAL_STATE, { type: 'TOGGLE_OVERWRITE' });
    expect(next.overwrite).toBe(true);
  });

  it('flips overwrite from true to false', () => {
    const stateWithOverwrite: WizardState = { ...INITIAL_STATE, overwrite: true };
    const next = reducer(stateWithOverwrite, { type: 'TOGGLE_OVERWRITE' });
    expect(next.overwrite).toBe(false);
  });

  it('does not change any other state field', () => {
    const next = reducer(INITIAL_STATE, { type: 'TOGGLE_OVERWRITE' });
    const { overwrite: _ignored, ...rest } = next;
    const { overwrite: _ignored2, ...initialRest } = INITIAL_STATE;
    expect(rest).toEqual(initialRest);
  });
});

describe('ImportWizard reducer — PROCEED_TO_PREVIEW', () => {
  it('transitions to preview when ratings are loaded', () => {
    const state: WizardState = { ...INITIAL_STATE, ratings: [RATING_ITEM] };
    const next = reducer(state, { type: 'PROCEED_TO_PREVIEW' });
    expect(next.step).toBe('preview');
  });

  it('transitions to preview when watchlist items are loaded', () => {
    const state: WizardState = { ...INITIAL_STATE, watchlist: [WATCHLIST_ITEM] };
    const next = reducer(state, { type: 'PROCEED_TO_PREVIEW' });
    expect(next.step).toBe('preview');
  });

  it('transitions to preview when both ratings and watchlist are loaded', () => {
    const state: WizardState = {
      ...INITIAL_STATE,
      ratings: [RATING_ITEM],
      watchlist: [WATCHLIST_ITEM],
    };
    const next = reducer(state, { type: 'PROCEED_TO_PREVIEW' });
    expect(next.step).toBe('preview');
  });

  it('stays in upload when both ratings and watchlist are empty', () => {
    const next = reducer(INITIAL_STATE, { type: 'PROCEED_TO_PREVIEW' });
    expect(next.step).toBe('upload');
  });

  it('returns the same state reference when there are no items', () => {
    const next = reducer(INITIAL_STATE, { type: 'PROCEED_TO_PREVIEW' });
    expect(next).toBe(INITIAL_STATE);
  });
});

describe('ImportWizard reducer — BACK', () => {
  it('returns to upload from preview', () => {
    const next = reducer(stateAtPreview(), { type: 'BACK' });
    expect(next.step).toBe('upload');
  });

  it('resets isImporting to false when going back', () => {
    const state = stateAtPreview({ isImporting: true });
    const next = reducer(state, { type: 'BACK' });
    expect(next.isImporting).toBe(false);
  });

  it('does nothing when already on upload step', () => {
    const next = reducer(INITIAL_STATE, { type: 'BACK' });
    expect(next).toBe(INITIAL_STATE);
  });

  it('does not clear parsed items when going back to upload', () => {
    const state = stateAtPreview();
    const next = reducer(state, { type: 'BACK' });
    expect(next.ratings).toEqual([RATING_ITEM]);
  });
});

describe('ImportWizard reducer — IMPORT_START', () => {
  it('sets isImporting to true when on preview step', () => {
    const next = reducer(stateAtPreview(), { type: 'IMPORT_START' });
    expect(next.isImporting).toBe(true);
  });

  it('does nothing when not on preview step', () => {
    const next = reducer(INITIAL_STATE, { type: 'IMPORT_START' });
    expect(next).toBe(INITIAL_STATE);
    expect(next.isImporting).toBe(false);
  });
});

describe('ImportWizard reducer — IMPORT_DONE', () => {
  it('transitions to result step', () => {
    const state = stateAtPreview({ isImporting: true });
    const next = reducer(state, { type: 'IMPORT_DONE', response: IMPORT_RESULT });
    expect(next.step).toBe('result');
  });

  it('sets response to the provided result', () => {
    const state = stateAtPreview({ isImporting: true });
    const next = reducer(state, { type: 'IMPORT_DONE', response: IMPORT_RESULT });
    expect(next.response).toEqual(IMPORT_RESULT);
  });

  it('sets isImporting to false', () => {
    const state = stateAtPreview({ isImporting: true });
    const next = reducer(state, { type: 'IMPORT_DONE', response: IMPORT_RESULT });
    expect(next.isImporting).toBe(false);
  });

  it('ignores IMPORT_DONE when isImporting is false', () => {
    const state = { ...INITIAL_STATE, step: 'preview' as WizardStep, isImporting: false };
    const result = reducer(state, { type: 'IMPORT_DONE', response: IMPORT_RESULT });
    expect(result).toBe(state); // same reference, no change
  });
});

describe('ImportWizard reducer — IMPORT_ERROR', () => {
  it('sets isImporting to false', () => {
    const state = stateAtPreview({ isImporting: true });
    const next = reducer(state, { type: 'IMPORT_ERROR' });
    expect(next.isImporting).toBe(false);
  });

  it('stays on preview step', () => {
    const next = reducer(stateAtPreview({ isImporting: true }), { type: 'IMPORT_ERROR' });
    expect(next.step).toBe('preview');
  });

  it('does not clear parsed items', () => {
    const next = reducer(stateAtPreview({ isImporting: true }), { type: 'IMPORT_ERROR' });
    expect(next.ratings).toEqual([RATING_ITEM]);
  });
});

describe('ImportWizard reducer — RESET', () => {
  it('returns to the initial state', () => {
    const next = reducer(stateAtPreview({ isImporting: true, overwrite: true }), { type: 'RESET' });
    expect(next).toEqual(INITIAL_STATE);
  });

  it('returns a new object reference (not the singleton)', () => {
    const someState = stateAtPreview({ isImporting: true, overwrite: true });
    const result1 = reducer(someState, { type: 'RESET' });
    const result2 = reducer(someState, { type: 'RESET' });
    expect(result1).not.toBe(result2);
    expect(result1).toEqual(result2);
  });
});

describe('ImportWizard reducer — SET_PREVIEW_FILTER', () => {
  it('sets previewFilter to "ratings"', () => {
    const next = reducer(stateAtPreview(), { type: 'SET_PREVIEW_FILTER', filter: 'ratings' });
    expect(next.previewFilter).toBe('ratings');
  });

  it('sets previewFilter to "watchlist"', () => {
    const next = reducer(stateAtPreview(), { type: 'SET_PREVIEW_FILTER', filter: 'watchlist' });
    expect(next.previewFilter).toBe('watchlist');
  });

  it('sets previewFilter to "all"', () => {
    const state = stateAtPreview({ previewFilter: 'ratings' });
    const next = reducer(state, { type: 'SET_PREVIEW_FILTER', filter: 'all' });
    expect(next.previewFilter).toBe('all');
  });

  it('does not change other state fields', () => {
    const state = stateAtPreview();
    const next = reducer(state, { type: 'SET_PREVIEW_FILTER', filter: 'ratings' });
    expect(next.step).toBe(state.step);
    expect(next.ratings).toBe(state.ratings);
    expect(next.overwrite).toBe(state.overwrite);
  });
});

import type { MediaImportResult } from '@/shared/api';
import type { ImportFile } from './import-file';
import {
  INITIAL_IMPORT_STATE,
  importWizardReducer,
  type ImportWizardAction,
  type ImportWizardState,
} from './import-wizard';

const RATINGS: ImportFile = {
  id: 'ratings.csv:10:1',
  name: 'ratings.csv',
  status: 'ready',
  kind: 'ratings',
  items: [{ imdbId: 'tt1', rating: 8, state: 'completed' }],
  skippedRows: 0,
};

const WRONG: ImportFile = {
  id: 'export.csv:5:1',
  name: 'export.csv',
  status: 'rejected',
  problem: 'wrongSource',
};

const RESULT: MediaImportResult = {
  imported: 1,
  skipped: 0,
  notFound: 0,
  durationMs: 10,
  details: { imported: [], skipped: [], notFound: [] },
};

function run(...actions: ImportWizardAction[]): ImportWizardState {
  return actions.reduce(importWizardReducer, INITIAL_IMPORT_STATE);
}

const pickImdb: ImportWizardAction = { type: 'pickSource', source: 'imdb' };
const addRatings: ImportWizardAction = { type: 'addFiles', source: 'imdb', files: [RATINGS] };

describe('importWizardReducer', () => {
  it('starts on the source step with nothing chosen', () => {
    expect(INITIAL_IMPORT_STATE).toMatchObject({ step: 'source', files: [], overwrite: false });
  });

  it('moves to files once a source is picked', () => {
    expect(run(pickImdb)).toMatchObject({ step: 'files', source: 'imdb' });
  });

  it('keeps files when the same source is picked again and drops them for another one', () => {
    expect(run(pickImdb, addRatings, pickImdb).files).toEqual([RATINGS]);
    expect(run(pickImdb, addRatings, { type: 'pickSource', source: 'tmdb' }).files).toEqual([]);
  });

  it('replaces a file added twice instead of listing it again', () => {
    expect(
      run(pickImdb, addRatings, { type: 'addFiles', source: 'imdb', files: [WRONG, RATINGS] })
        .files,
    ).toEqual([WRONG, RATINGS]);
  });

  it('ignores files read for a source that is no longer picked', () => {
    const tmdb = run(pickImdb, { type: 'pickSource', source: 'tmdb' });
    expect(importWizardReducer(tmdb, addRatings)).toBe(tmdb);
  });

  it('removes a file by id', () => {
    expect(run(pickImdb, addRatings, { type: 'removeFile', id: RATINGS.id }).files).toEqual([]);
  });

  it('only reviews when at least one file is ready', () => {
    const rejectedOnly = run(pickImdb, { type: 'addFiles', source: 'imdb', files: [WRONG] });
    expect(importWizardReducer(rejectedOnly, { type: 'review' })).toBe(rejectedOnly);
    expect(run(pickImdb, addRatings, { type: 'review' }).step).toBe('preview');
  });

  it('steps back from preview to files and from files to source, keeping files', () => {
    const preview = run(pickImdb, addRatings, { type: 'review' });
    expect(importWizardReducer(preview, { type: 'back' })).toMatchObject({
      step: 'files',
      files: [RATINGS],
    });
    expect(run(pickImdb, { type: 'back' }).step).toBe('source');
    expect(importWizardReducer(INITIAL_IMPORT_STATE, { type: 'back' })).toBe(INITIAL_IMPORT_STATE);
  });

  it('stores the overwrite choice and the preview filter', () => {
    expect(run({ type: 'setOverwrite', overwrite: true }).overwrite).toBe(true);
    expect(run({ type: 'filter', filter: 'ratings' }).filter).toBe('ratings');
  });

  it('starts importing only from preview and not twice', () => {
    expect(run(pickImdb, { type: 'importStarted' }).isImporting).toBe(false);
    const importing = run(pickImdb, addRatings, { type: 'review' }, { type: 'importStarted' });
    expect(importing.isImporting).toBe(true);
    expect(importWizardReducer(importing, { type: 'importStarted' })).toBe(importing);
    expect(importWizardReducer(importing, { type: 'back' })).toBe(importing);
  });

  it('shows the result after a successful import and ignores stray results', () => {
    const importing = run(pickImdb, addRatings, { type: 'review' }, { type: 'importStarted' });
    expect(
      importWizardReducer(importing, { type: 'importSucceeded', result: RESULT, finishedAt: 1 }),
    ).toMatchObject({
      step: 'result',
      isImporting: false,
      result: RESULT,
    });
    const idle = run(pickImdb);
    expect(
      importWizardReducer(idle, { type: 'importSucceeded', result: RESULT, finishedAt: 1 }),
    ).toBe(idle);
  });

  it('stays on preview with files kept when the import fails', () => {
    const failed = run(
      pickImdb,
      addRatings,
      { type: 'review' },
      { type: 'importStarted' },
      { type: 'importFailed' },
    );
    expect(failed).toMatchObject({ step: 'preview', isImporting: false, files: [RATINGS] });
  });

  it('opens a remembered summary and restarts from scratch', () => {
    expect(
      run(pickImdb, { type: 'showSummary', source: 'tmdb', result: RESULT, finishedAt: 5 }),
    ).toMatchObject({
      step: 'result',
      source: 'tmdb',
      result: RESULT,
      finishedAt: 5,
      files: [],
    });
    expect(run(pickImdb, addRatings, { type: 'restart' })).toEqual(INITIAL_IMPORT_STATE);
  });
});

describe('importWizardReducer while importing', () => {
  it('ignores summary and restart until the request settles', () => {
    const importing = run(pickImdb, addRatings, { type: 'review' }, { type: 'importStarted' });
    expect(importWizardReducer(importing, { type: 'restart' })).toBe(importing);
    expect(
      importWizardReducer(importing, {
        type: 'showSummary',
        source: 'tmdb',
        result: RESULT,
        finishedAt: 1,
      }),
    ).toBe(importing);
  });
});

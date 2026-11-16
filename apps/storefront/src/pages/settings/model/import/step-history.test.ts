import { decidePop, isStepEntry, screenOf } from './step-history';

const entry = (importScreen: number, importRun = 'run-1') => ({
  importRun,
  importScreen,
  __NA: true,
});

describe('screenOf', () => {
  it('counts phone screens one per step and merges source into files on desktop', () => {
    expect(screenOf('preview', false)).toBe(2);
    expect(screenOf('source', true)).toBe(0);
    expect(screenOf('files', true)).toBe(0);
    expect(screenOf('result', false)).toBeUndefined();
  });
});

describe('decidePop', () => {
  const base = { run: 'run-1', isImporting: false };

  it('steps back to an earlier screen of the same run', () => {
    expect(decidePop({ ...base, target: entry(1), screen: 2 })).toEqual({
      kind: 'stepBack',
      steps: 1,
    });
  });

  it('keeps the screen while the import request runs', () => {
    expect(decidePop({ ...base, target: entry(1), screen: 2, isImporting: true })).toEqual({
      kind: 'stay',
    });
  });

  it('leaves the page from the result, skipping the run’s earlier screens', () => {
    expect(decidePop({ ...base, target: entry(2), screen: undefined })).toEqual({
      kind: 'leave',
      distance: 3,
    });
  });

  it('leaves past entries of an earlier run after a restart', () => {
    expect(decidePop({ ...base, target: entry(1, 'run-0'), screen: 0 })).toEqual({
      kind: 'leave',
      distance: 2,
    });
  });

  it('snaps a browser forward back to the shown screen and ignores the shown one', () => {
    expect(decidePop({ ...base, target: entry(2), screen: 0 })).toEqual({
      kind: 'snapBack',
      distance: 2,
    });
    expect(decidePop({ ...base, target: entry(1), screen: 1 })).toEqual({ kind: 'none' });
  });

  it('lets other pages’ entries through', () => {
    expect(decidePop({ ...base, target: { __NA: true }, screen: 1 })).toEqual({ kind: 'none' });
    expect(isStepEntry(null)).toBe(false);
  });
});

import { act, renderHook } from '@testing-library/react';
import type { MediaImportResult } from '@/shared/api';
import { rememberImport, useLastImport, type LastImport } from './last-import';

const RESULT: MediaImportResult = {
  imported: 1,
  skipped: 0,
  notFound: 0,
  durationMs: 1,
  details: { imported: [], skipped: [], notFound: [] },
};

const ENTRY: LastImport = { userId: 'u1', source: 'imdb', finishedAt: 5, result: RESULT };

describe('last import', () => {
  it('stores a versioned entry and shows it only to its owner', () => {
    const { result: owner } = renderHook(() => useLastImport('u1'));
    const { result: other } = renderHook(() => useLastImport('u2'));

    act(() => rememberImport(ENTRY));

    expect(owner.current).toEqual(ENTRY);
    expect(other.current).toBeUndefined();
    expect(JSON.parse(window.sessionStorage.getItem('ratingo:last-import') ?? '')).toEqual({
      version: 1,
      entry: ENTRY,
    });
  });
});

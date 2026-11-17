import type { LibraryCounts } from '@/shared/api';
import { librarySizeBucket } from './library-size-reporter';

const counts = (watching: number, forLater = 0): LibraryCounts =>
  ({
    watching,
    paused: 0,
    dropped: 0,
    completed: 0,
    caughtUp: 0,
    forLater,
    considering: 0,
  }) as LibraryCounts;

describe('librarySizeBucket', () => {
  it.each<[LibraryCounts, string]>([
    [counts(0), '0'],
    [counts(1, 1), '1-2'],
    [counts(3), '3-9'],
    [counts(9), '3-9'],
    [counts(5, 5), '10+'],
  ])('puts %o into %s', (input, bucket) => {
    expect(librarySizeBucket(input)).toBe(bucket);
  });
});

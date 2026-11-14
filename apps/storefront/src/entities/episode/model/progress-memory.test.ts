import type { ShowProgress } from '@/shared/api';
import {
  parseRememberedCounts,
  recallWatchedCount,
  rememberProgress,
  withRememberedCount,
} from './progress-memory';

function progressOf(showId: string, watchedEpisodeIds: string[]): ShowProgress {
  return {
    showId,
    seasons: [
      { seasonNumber: 1, watchedCount: watchedEpisodeIds.length, totalCount: 8, watchedEpisodeIds },
    ],
  };
}

function show(showId: string, watchedCount = 0) {
  return { showId, watchedCount };
}

describe('parseRememberedCounts', () => {
  it('returns nothing for empty or broken storage', () => {
    expect(parseRememberedCounts(null)).toBeUndefined();
    expect(parseRememberedCounts('not json')).toBeUndefined();
    expect(parseRememberedCounts('[]')).toBeUndefined();
    expect(parseRememberedCounts('{"userId":1,"shows":[]}')).toBeUndefined();
  });

  it('keeps only well-formed shows', () => {
    const raw = JSON.stringify({
      userId: 'u1',
      shows: [show('a', 2), { showId: 'b' }, { showId: 3, watchedCount: 1 }],
    });

    expect(parseRememberedCounts(raw)).toEqual({ userId: 'u1', shows: [show('a', 2)] });
  });

  it('caps the number of remembered shows', () => {
    const shows = Array.from({ length: 30 }, (_, index) => show(`s${index}`));

    expect(parseRememberedCounts(JSON.stringify({ userId: 'u1', shows }))?.shows).toHaveLength(20);
  });
});

describe('withRememberedCount', () => {
  it('moves the updated show to the front without duplicating it', () => {
    const counts = { userId: 'u1', shows: [show('a'), show('b'), show('c')] };

    expect(withRememberedCount(counts, 'u1', show('b', 4)).shows).toEqual([
      show('b', 4),
      show('a'),
      show('c'),
    ]);
  });

  it('forgets what another user watched', () => {
    const counts = { userId: 'u2', shows: [show('a', 5)] };

    expect(withRememberedCount(counts, 'u1', show('b', 1))).toEqual({
      userId: 'u1',
      shows: [show('b', 1)],
    });
  });

  it('drops the least recently remembered show past the limit', () => {
    const shows = Array.from({ length: 20 }, (_, index) => show(`s${index}`));
    const result = withRememberedCount({ userId: 'u1', shows }, 'u1', show('new'));

    expect(result.shows).toHaveLength(20);
    expect(result.shows[0].showId).toBe('new');
    expect(result.shows.some((candidate) => candidate.showId === 's19')).toBe(false);
  });
});

describe('remembered counts in storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('recalls how many episodes of a show were watched', () => {
    rememberProgress('u1', 's1', progressOf('s1', ['e1', 'e2']));

    expect(recallWatchedCount('s1')).toBe(2);
    expect(recallWatchedCount('unknown')).toBe(0);
  });

  it('stops recalling shows of the previous user once another user syncs', () => {
    rememberProgress('u1', 's1', progressOf('s1', ['e1']));
    rememberProgress('u2', 's2', progressOf('s2', []));

    expect(recallWatchedCount('s1')).toBe(0);
  });
});

import type { CalendarEpisode, CalendarRange, UserMediaState } from '@/shared/api';
import { remainingEpisodes, splitWatching } from './watching-sections';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const PAST = '2026-11-14T10:00:00Z';
const FUTURE = '2026-11-20T10:00:00Z';

function show(id: string, overrides: Partial<UserMediaState> = {}): UserMediaState {
  return {
    id: `state-${id}`,
    userId: 'user',
    mediaItemId: id,
    state: 'watching',
    rating: null,
    progress: null,
    notes: null,
    createdAt: PAST,
    updatedAt: PAST,
    mediaSummary: { id, type: 'show', title: `Show ${id}`, slug: id, poster: null },
    progressSummary: { watched: 3, total: 10 },
    continuePoint: { season: 1, episode: 4, episodeId: `ep-${id}`, airDate: PAST },
    ...overrides,
  };
}

function episode(showId: string, overrides: Partial<CalendarEpisode> = {}): CalendarEpisode {
  return {
    episodeId: `new-${showId}`,
    showId,
    showRecordId: `record-${showId}`,
    showSlug: showId,
    showTitle: `Show ${showId}`,
    seasonNumber: 2,
    episodeNumber: 1,
    title: null,
    airDate: PAST,
    seasonEpisodeCount: 8,
    showPopularity: 1,
    isTracked: true,
    isSaved: false,
    isWatched: false,
    ...overrides,
  };
}

function range(episodes: CalendarEpisode[]): CalendarRange {
  return { startDate: PAST, endDate: PAST, days: [{ date: '2026-11-14', episodes }] };
}

describe('splitWatching', () => {
  it('puts shows with a new unwatched episode first and flags season premieres', () => {
    const { fresh, next } = splitWatching([show('a'), show('b')], [], range([episode('a')]), NOW);

    expect(fresh.map((row) => row.title.mediaItemId)).toEqual(['a']);
    expect(fresh[0]).toMatchObject({ isNewSeason: true, showRecordId: 'record-a' });
    expect(next.map((row) => row.title.mediaItemId)).toEqual(['b']);
  });

  it('orders new episodes from the most recently aired', () => {
    const recent = range([
      episode('a', { airDate: '2026-11-12T10:00:00Z' }),
      episode('b', { airDate: PAST }),
    ]);
    const { fresh } = splitWatching([show('a'), show('b')], [], recent, NOW);

    expect(fresh.map((row) => row.title.mediaItemId)).toEqual(['b', 'a']);
  });

  it('ignores watched, untracked and future calendar episodes', () => {
    const recent = range([
      episode('a', { isWatched: true }),
      episode('b', { isTracked: false }),
      episode('c', { airDate: FUTURE }),
    ]);
    const { fresh } = splitWatching([show('a'), show('b'), show('c')], [], recent, NOW);

    expect(fresh).toEqual([]);
  });

  it('waits for shows without an aired next episode and for caught-up shows', () => {
    const upcoming = show('a', {
      continuePoint: { season: 1, episode: 5, episodeId: 'ep', airDate: FUTURE },
    });
    const caughtUp = show('b', { state: 'caught_up', continuePoint: null });
    const { next, waiting } = splitWatching([upcoming], [caughtUp], undefined, NOW);

    expect(next).toEqual([]);
    expect(waiting.map((row) => row.title.mediaItemId)).toEqual(['a', 'b']);
    expect(waiting[0].episode?.airDate).toBe(FUTURE);
  });

  it('counts the episodes left without going negative', () => {
    const { next } = splitWatching(
      [show('a', { progressSummary: { watched: 12, total: 10 } })],
      [],
      undefined,
      NOW,
    );
    expect(remainingEpisodes(next[0])).toBe(0);
  });
});

import fc from 'fast-check';
import type { ShowProgress } from '@/shared/api';
import {
  applyWatchChange,
  currentSeason,
  seasonProgress,
  summarizeProgress,
  unwatchedAired,
  unwatchedThrough,
  watchedIn,
  watchedEpisodeIds,
} from './progress';
import type { Episode, Season } from './season';

const NOW = Date.parse('2026-11-14T12:00:00Z');

function episode(seasonNumber: number, number: number, airDate = '2024-01-01'): Episode {
  return { id: `s${seasonNumber}e${number}`, seasonNumber, number, airDate };
}

const SEASONS: Season[] = [
  { number: 1, episodes: [episode(1, 1), episode(1, 2), episode(1, 3)] },
  {
    number: 2,
    episodes: [
      episode(2, 1),
      episode(2, 2),
      { seasonNumber: 2, number: 3, airDate: '2024-02-01' },
      episode(2, 4, '2027-01-01'),
    ],
  },
];

function progressOf(...watched: string[][]): ShowProgress {
  return {
    showId: 'show',
    seasons: watched.map((ids, index) => ({
      seasonNumber: index + 1,
      watchedCount: ids.length,
      totalCount: SEASONS[index].episodes.length,
      watchedEpisodeIds: ids,
    })),
  };
}

describe('applyWatchChange', () => {
  it('marks episodes in the seasons they belong to and keeps the counts in step', () => {
    const next = applyWatchChange(
      progressOf(['s1e1'], []),
      { episodeIds: ['s1e2', 's2e1'], watched: true },
      SEASONS,
    );

    expect(next.seasons).toEqual([
      { seasonNumber: 1, watchedCount: 2, totalCount: 3, watchedEpisodeIds: ['s1e1', 's1e2'] },
      { seasonNumber: 2, watchedCount: 1, totalCount: 4, watchedEpisodeIds: ['s2e1'] },
    ]);
  });

  it('unmarks episodes and leaves untouched seasons as they were', () => {
    const before = progressOf(['s1e1', 's1e2'], ['s2e1']);
    const next = applyWatchChange(before, { episodeIds: ['s1e2'], watched: false }, SEASONS);

    expect(next.seasons[0].watchedEpisodeIds).toEqual(['s1e1']);
    expect(next.seasons[0].watchedCount).toBe(1);
    expect(next.seasons[1]).toBe(before.seasons[1]);
  });

  it('adds a season the API has not reported progress for yet', () => {
    const next = applyWatchChange(
      progressOf(['s1e1']),
      { episodeIds: ['s2e2'], watched: true },
      SEASONS,
    );

    expect(next.seasons.map((season) => season.seasonNumber)).toEqual([1, 2]);
    expect(next.seasons[1].watchedEpisodeIds).toEqual(['s2e2']);
  });

  it('is idempotent and undone by the opposite change', () => {
    const allIds = SEASONS.flatMap((season) =>
      season.episodes.flatMap((e) => (e.id ? [e.id] : [])),
    );
    fc.assert(
      fc.property(
        fc.subarray(allIds),
        fc.subarray(allIds),
        fc.boolean(),
        (initial, changed, watched) => {
          const start = applyWatchChange(
            progressOf([], []),
            { episodeIds: initial, watched: true },
            SEASONS,
          );
          const change = { episodeIds: changed, watched };
          const once = applyWatchChange(start, change, SEASONS);
          const twice = applyWatchChange(once, change, SEASONS);

          expect(watchedEpisodeIds(twice)).toEqual(watchedEpisodeIds(once));
          for (const id of changed) expect(watchedEpisodeIds(once).has(id)).toBe(watched);
          for (const season of once.seasons) {
            expect(season.watchedCount).toBe(season.watchedEpisodeIds.length);
          }
        },
      ),
    );
  });
});

describe('summarizeProgress', () => {
  it('counts only aired episodes that can be tracked', () => {
    expect(summarizeProgress(SEASONS, new Set(), NOW)).toMatchObject({ watched: 0, aired: 5 });
  });

  it('points at the first unwatched episode after the latest watched one', () => {
    const summary = summarizeProgress(SEASONS, new Set(['s1e1', 's1e3']), NOW);

    expect(summary.watched).toBe(2);
    expect(summary.next?.id).toBe('s2e1');
  });

  it('points back at a gap once everything after it is watched', () => {
    const watched = new Set(['s1e1', 's1e3', 's2e1', 's2e2']);
    const summary = summarizeProgress(SEASONS, watched, NOW);

    expect(summary).toMatchObject({ watched: 4, aired: 5 });
    expect(summary.next?.id).toBe('s1e2');
  });

  it('has no next episode once everything aired is watched', () => {
    const watched = new Set(['s1e1', 's1e2', 's1e3', 's2e1', 's2e2']);
    expect(summarizeProgress(SEASONS, watched, NOW)).toEqual({ watched: 5, aired: 5 });
  });

  it('finishes a show whose latest season has only undated or upcoming placeholders', () => {
    const seasons: Season[] = [
      ...SEASONS,
      {
        number: 3,
        episodes: [
          episode(3, 1, '2027-07-09'),
          { id: 's3e2', seasonNumber: 3, number: 2 },
          { id: 's3e3', seasonNumber: 3, number: 3 },
        ],
      },
    ];
    const watched = new Set(['s1e1', 's1e2', 's1e3', 's2e1', 's2e2']);

    const summary = summarizeProgress(seasons, watched, NOW);

    expect(summary).toEqual({ watched: 5, aired: 5 });
    expect(seasonProgress(seasons[2], watched, NOW)).toEqual({ watched: 0, aired: 0 });
    expect(currentSeason(seasons, summary, watched, NOW).number).toBe(2);
    expect(unwatchedThrough(seasons, seasons[2].episodes[1], watched, NOW)).toEqual([]);
  });
});

describe('seasonProgress', () => {
  it('counts a season on its own', () => {
    expect(seasonProgress(SEASONS[1], new Set(['s1e1', 's2e2']), NOW)).toEqual({
      watched: 1,
      aired: 2,
    });
  });
});

describe('catch-up selections', () => {
  it('collects the unwatched aired episodes up to and including one, across seasons', () => {
    const through = unwatchedThrough(SEASONS, SEASONS[1].episodes[1], new Set(['s1e2']), NOW);
    expect(through).toEqual(['s1e1', 's1e3', 's2e1', 's2e2']);
  });

  it('stays inside the seasons it is given', () => {
    const through = unwatchedThrough([SEASONS[1]], SEASONS[1].episodes[1], new Set(), NOW);
    expect(through).toEqual(['s2e1', 's2e2']);
  });

  it('collects nothing for an upcoming episode or an episode without an id', () => {
    expect(unwatchedThrough(SEASONS, SEASONS[1].episodes[3], new Set(), NOW)).toEqual([]);
    expect(unwatchedThrough(SEASONS, SEASONS[1].episodes[2], new Set(), NOW)).toEqual([]);
  });

  it('lists the watched episodes of a season for a reset', () => {
    expect(watchedIn(SEASONS[1], new Set(['s1e1', 's2e2']))).toEqual(['s2e2']);
  });

  it('collects every unwatched aired episode and skips upcoming ones', () => {
    expect(unwatchedAired(SEASONS, new Set(['s1e1']), NOW)).toEqual([
      's1e2',
      's1e3',
      's2e1',
      's2e2',
    ]);
  });
});

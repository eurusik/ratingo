import { addUtcDays, utcDateFromDayId } from '@/common/utils/date.util';

import {
  episodeDetailsUpdates,
  needsTmdbDetails,
  renumberedTitleRepairs,
  seasonsMissingDetails,
  seasonsWithUkrainianTitles,
} from './episode-backfill-plan';
import { type StoredEpisode } from './models/episode-details.model';
import { type TmdbSeasonEpisodes, type TvMazeEpisodeText } from './models/episode-sources.model';
import { type NormalizedEpisode } from './models/normalized-media.model';

const day = utcDateFromDayId;
const NOW_MS = addUtcDays(day('20261127'), 0.5).getTime();
const complete = {
  title: 'Пілот',
  overview: 'Опис',
  airDate: day('20200101'),
  runtime: 45,
  stillPath: '/still.jpg',
  rating: 8,
};
const stored = (
  seasonNumber: number,
  number: number,
  details: Partial<StoredEpisode> = {},
): StoredEpisode => ({
  id: `s${seasonNumber}e${number}`,
  seasonNumber,
  number,
  ...complete,
  ...details,
});
const tmdb = (number: number, details: Partial<NormalizedEpisode> = {}): NormalizedEpisode => ({
  number,
  title: `Серія ${number}`,
  ...details,
});
const sources = (
  localized: [number, NormalizedEpisode[]][],
  english: [number, NormalizedEpisode[]][] = [],
): TmdbSeasonEpisodes => ({ localized: new Map(localized), english: new Map(english) });

describe('needsTmdbDetails', () => {
  it.each([
    ['an English title', { title: 'Pilot' }],
    ['a placeholder title', { title: 'Серія 1' }],
    ['an English overview', { overview: 'English' }],
    ['no air date', { airDate: null }],
    ['an aired episode without runtime', { runtime: null }],
    ['an aired episode without still', { stillPath: null }],
    ['an aired episode without rating', { rating: null }],
  ])('needs TMDB for %s', (_case, gap) => {
    expect(needsTmdbDetails(stored(1, 1, gap), NOW_MS)).toBe(true);
  });

  it('does not count a missing still, runtime or rating before the episode airs', () => {
    const upcoming = stored(1, 1, {
      airDate: day('20261205'),
      runtime: null,
      stillPath: null,
      rating: null,
    });

    expect(needsTmdbDetails(upcoming, NOW_MS)).toBe(false);
  });

  it('does not need TMDB for a complete Ukrainian episode', () => {
    expect(needsTmdbDetails(stored(1, 1), NOW_MS)).toBe(false);
  });

  it('lists each season with a gap once, in order', () => {
    expect(
      seasonsMissingDetails(
        [
          stored(3, 1, { title: 'Return' }),
          stored(1, 1),
          stored(3, 2, { stillPath: null }),
          stored(2, 1, { runtime: null }),
        ],
        NOW_MS,
      ),
    ).toEqual([2, 3]);
  });
});

describe('episodeDetailsUpdates', () => {
  it('updates only episodes that change and keeps what TMDB lacks', () => {
    const updates = episodeDetailsUpdates(
      [
        stored(1, 1, { title: 'Pilot', overview: 'English', stillPath: null }),
        stored(1, 2, { title: 'Second' }),
        stored(1, 3, { title: 'Third', runtime: null }),
      ],
      sources([
        [
          1,
          [
            tmdb(1, { title: 'Пілот', overview: 'Опис', stillPath: '/1.jpg' }),
            tmdb(2, { overview: 'Інший опис', stillPath: '/other.jpg' }),
            tmdb(3, { runtime: null }),
          ],
        ],
      ]),
      NOW_MS,
    );

    expect(updates).toEqual([
      {
        id: 's1e1',
        next: { ...complete, stillPath: '/1.jpg' },
        previous: { ...complete, title: 'Pilot', overview: 'English', stillPath: null },
      },
      {
        id: 's1e2',
        next: { ...complete, title: 'Second', overview: 'Інший опис' },
        previous: { ...complete, title: 'Second' },
      },
    ]);
  });

  it('matches stored episodes of a renumbered season by English title only', () => {
    const updates = episodeDetailsUpdates(
      [
        stored(5, 1, { title: 'Rise and Shine', stillPath: null }),
        stored(5, 2, { title: 'Waiting', stillPath: null }),
      ],
      sources(
        [
          [
            5,
            [
              tmdb(1, { stillPath: '/waiting.jpg' }),
              tmdb(2, { stillPath: '/other.jpg' }),
              tmdb(3, { stillPath: '/third.jpg' }),
            ],
          ],
        ],
        [[5, [tmdb(1, { title: 'Waiting' }), tmdb(2, { title: 'Other' }), tmdb(3)]]],
      ),
      NOW_MS,
    );

    expect(updates).toEqual([
      {
        id: 's5e2',
        next: { ...complete, title: 'Waiting', stillPath: '/waiting.jpg' },
        previous: { ...complete, title: 'Waiting', stillPath: null },
      },
    ]);
  });
});

describe('renumberedTitleRepairs', () => {
  const tvMaze = (
    number: number,
    title: string,
    overview: string | null = null,
  ): TvMazeEpisodeText => ({
    seasonNumber: 5,
    number,
    title,
    overview,
  });

  it('lists only seasons that hold a real Ukrainian title', () => {
    expect(
      seasonsWithUkrainianTitles([
        stored(1, 1),
        stored(2, 1, { title: 'Серія 1' }),
        stored(3, 1, { title: 'English' }),
      ]),
    ).toEqual([1]);
  });

  it('replaces a Ukrainian title copied from the wrong TMDB episode', () => {
    const repairs = renumberedTitleRepairs(
      [
        stored(5, 1, { title: 'Чекання', overview: 'Опис чекання' }),
        stored(5, 2, { title: 'Чекання' }),
      ],
      [tvMaze(1, 'Rise and Shine', 'English summary'), tvMaze(2, 'Waiting')],
      sources(
        [[5, [tmdb(1, { title: 'Чекання' }), tmdb(2), tmdb(3)]]],
        [[5, [tmdb(1, { title: 'Waiting' }), tmdb(2, { title: 'Other' }), tmdb(3)]]],
      ),
      [5],
    );

    expect(repairs).toEqual([
      {
        id: 's5e1',
        next: { ...complete, title: 'Rise and Shine', overview: 'English summary' },
        previous: { ...complete, title: 'Чекання', overview: 'Опис чекання' },
      },
      {
        id: 's5e2',
        next: { ...complete, title: 'Чекання', overview: null },
        previous: { ...complete, title: 'Чекання' },
      },
    ]);
  });

  it('changes nothing on a second run', () => {
    const repaired = [
      stored(5, 1, { title: 'Rise and Shine', overview: null }),
      stored(5, 2, { title: 'Чекання', overview: null }),
    ];

    expect(
      renumberedTitleRepairs(
        repaired,
        [tvMaze(1, 'Rise and Shine'), tvMaze(2, 'Waiting')],
        sources(
          [[5, [tmdb(1, { title: 'Чекання' }), tmdb(2), tmdb(3)]]],
          [[5, [tmdb(1, { title: 'Waiting' }), tmdb(2, { title: 'Other' }), tmdb(3)]]],
        ),
        [5],
      ),
    ).toEqual([]);
  });
});

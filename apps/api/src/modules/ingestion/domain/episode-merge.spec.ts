import fc from 'fast-check';

import { utcDateFromDayId } from '@/common/utils/date.util';

import {
  episodeDetailsUpdates,
  fillSeasonAirDates,
  mergeTmdbEpisodeDetails,
  needsTmdbDetails,
  renumberedSeasons,
  seasonsMissingDetails,
  storedEpisodeCounts,
  type TmdbSeasonEpisodes,
  tvMazeEpisodeCounts,
} from './episode-merge';
import { type StoredEpisode } from './models/episode-details.model';
import { type NormalizedEpisode } from './models/normalized-media.model';

const day = utcDateFromDayId;
const tmdbSources = (
  localized: [number, NormalizedEpisode[]][],
  english: [number, NormalizedEpisode[]][] = [],
): TmdbSeasonEpisodes => ({ localized: new Map(localized), english: new Map(english) });

describe('season episode counts', () => {
  it('counts the regular seasons that have TVMaze episodes', () => {
    expect(
      tvMazeEpisodeCounts([
        { number: 0, episodes: [{ number: 1, title: 'Special' }] },
        { number: 1, episodes: [{ tmdbId: 9, number: 1, title: 'Пілот' }] },
        {
          number: 2,
          episodes: [
            { number: 1, title: 'Return' },
            { number: 2, title: 'Again' },
          ],
        },
        { number: 3, episodes: [] },
      ]),
    ).toEqual(new Map([[2, 2]]));
  });

  it('flags seasons TMDB numbers with a different episode count', () => {
    const episodes = (count: number): NormalizedEpisode[] =>
      Array.from({ length: count }, (_, index) => ({ number: index + 1, title: 'Серія' }));

    expect(
      renumberedSeasons(
        new Map([
          [1, 2],
          [3, 37],
          [4, 5],
        ]),
        new Map([
          [1, episodes(2)],
          [3, episodes(40)],
        ]),
      ),
    ).toEqual([3]);
  });
});

describe('mergeTmdbEpisodeDetails', () => {
  it('takes each Ukrainian text separately and fills what TVMaze lacks from TMDB', () => {
    const [season] = mergeTmdbEpisodeDetails(
      [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'Pilot', overview: 'English one', runtime: 50 },
            {
              number: 2,
              title: 'Second',
              overview: 'English two',
              stillPath: 'https://tvmaze/2.jpg',
            },
            { number: 3, title: 'Third', overview: null },
          ],
        },
      ],
      tmdbSources([
        [
          1,
          [
            { number: 1, title: 'Пілот', overview: '', runtime: 22, stillPath: '/1.jpg' },
            { number: 2, title: 'Серія 2', overview: 'Другий опис', stillPath: '/2.jpg' },
            { number: 3, title: 'Серія 3', overview: null, rating: 7.5, airDate: day('20020517') },
          ],
        ],
      ]),
    );

    expect(season.episodes).toEqual([
      {
        number: 1,
        title: 'Пілот',
        overview: 'English one',
        airDate: null,
        runtime: 50,
        stillPath: '/1.jpg',
        rating: null,
      },
      {
        number: 2,
        title: 'Second',
        overview: 'Другий опис',
        airDate: null,
        runtime: null,
        stillPath: 'https://tvmaze/2.jpg',
        rating: null,
      },
      {
        number: 3,
        title: 'Third',
        overview: null,
        airDate: day('20020517'),
        runtime: null,
        stillPath: null,
        rating: 7.5,
      },
    ]);
  });

  it('keeps the TVMaze air date when both sources have one', () => {
    const airstamp = day('20260116');
    const [season] = mergeTmdbEpisodeDetails(
      [{ number: 1, episodes: [{ number: 1, title: 'Pilot', airDate: airstamp }] }],
      tmdbSources([[1, [{ number: 1, title: 'Серія 1', airDate: day('20260115') }]]]),
    );

    expect(season.episodes[0].airDate).toBe(airstamp);
  });

  it('pairs a renumbered season by English title and leaves unmatched episodes alone', () => {
    const [season] = mergeTmdbEpisodeDetails(
      [
        {
          number: 3,
          episodes: [
            { number: 1, title: 'The Snowball Effect' },
            { number: 2, title: 'Chimps Ahoy!' },
            { number: 3, title: 'Episode 3' },
            { number: 4, title: 'Lost in Translation' },
          ],
        },
      ],
      tmdbSources(
        [
          [
            3,
            [
              { number: 1, title: 'Серія 1', stillPath: '/1.jpg' },
              { number: 2, title: 'Сніжний ефект', stillPath: '/2.jpg' },
              { number: 3, title: 'Серія 3', stillPath: '/3.jpg' },
              { number: 4, title: 'Серія 4', stillPath: '/4.jpg' },
              { number: 5, title: 'Серія 5', stillPath: '/5.jpg' },
            ],
          ],
        ],
        [
          [
            3,
            [
              { number: 1, title: 'Chimps Ahoy' },
              { number: 2, title: 'Snowball Effect (Part 1)' },
              { number: 3, title: 'Episode 3' },
              { number: 4, title: 'Gone' },
              { number: 5, title: 'Gone' },
            ],
          ],
        ],
      ),
    );

    expect(season.episodes.map(({ title, stillPath }) => [title, stillPath])).toEqual([
      ['Сніжний ефект', '/2.jpg'],
      ['Chimps Ahoy!', '/1.jpg'],
      ['Episode 3', undefined],
      ['Lost in Translation', undefined],
    ]);
  });

  it('pairs nothing in a renumbered season without English titles', () => {
    const seasons = [
      {
        number: 5,
        episodes: [
          { number: 1, title: 'Rise and Shine' },
          { number: 2, title: 'Waiting' },
        ],
      },
    ];

    expect(
      mergeTmdbEpisodeDetails(
        seasons,
        tmdbSources([[5, [{ number: 1, title: 'Серія 1', stillPath: '/1.jpg' }]]]),
      ),
    ).toEqual(seasons);
  });

  it('leaves seasons and episodes TMDB does not know about', () => {
    const seasons = [
      { number: 1, episodes: [{ number: 9, title: 'Finale' }] },
      { number: 2, episodes: [{ number: 1, title: 'Return' }] },
    ];

    expect(
      mergeTmdbEpisodeDetails(seasons, tmdbSources([[1, [{ number: 1, title: 'Пілот' }]]])),
    ).toEqual(seasons);
  });

  it('never drops a value that either source has for a paired episode', () => {
    const optional = <T>(value: fc.Arbitrary<T>): fc.Arbitrary<T | null> =>
      fc.option(value, { nil: null });
    const details = fc.record({
      stillPath: optional(fc.string({ minLength: 1 })),
      runtime: optional(fc.integer({ min: 1, max: 300 })),
      rating: optional(fc.double({ min: 0.1, max: 10, noNaN: true })),
    });

    fc.assert(
      fc.property(details, details, (ours, tmdb) => {
        const [season] = mergeTmdbEpisodeDetails(
          [{ number: 1, episodes: [{ number: 1, title: 'Pilot', ...ours }] }],
          tmdbSources([[1, [{ number: 1, title: 'Серія 1', ...tmdb }]]]),
        );
        const merged = season.episodes[0];
        expect(merged.stillPath).toBe(ours.stillPath ?? tmdb.stillPath);
        expect(merged.runtime).toBe(ours.runtime ?? tmdb.runtime);
        expect(merged.rating).toBe(ours.rating ?? tmdb.rating);
      }),
    );
  });
});

describe('fillSeasonAirDates', () => {
  it('dates a season by its first aired episode only when TMDB gave the season no date', () => {
    const tmdbDate = day('20200101');
    const seasons = fillSeasonAirDates([
      {
        number: 1,
        airDate: tmdbDate,
        episodes: [{ number: 1, title: 'A', airDate: day('20200201') }],
      },
      {
        number: 2,
        airDate: null,
        episodes: [
          { number: 2, title: 'B', airDate: day('20210308') },
          { number: 1, title: 'A', airDate: day('20210301') },
          { number: 3, title: 'C', airDate: null },
        ],
      },
      { number: 3, episodes: [{ number: 1, title: 'TBA', airDate: null }] },
    ]);

    expect(seasons.map((season) => season.airDate)).toEqual([tmdbDate, day('20210301'), undefined]);
  });
});

describe('stored episode backfill', () => {
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

  it.each([
    ['an English title', { title: 'Pilot' }],
    ['a placeholder title', { title: 'Серія 1' }],
    ['an English overview', { overview: 'English' }],
    ['no air date', { airDate: null }],
    ['no runtime', { runtime: null }],
    ['no still', { stillPath: null }],
    ['no rating', { rating: null }],
  ])('needs TMDB for an episode with %s', (_case, gap) => {
    expect(needsTmdbDetails(stored(1, 1, gap))).toBe(true);
  });

  it('does not need TMDB for a complete Ukrainian episode', () => {
    expect(needsTmdbDetails(stored(1, 1))).toBe(false);
  });

  it('lists each season with a gap once, in order', () => {
    expect(
      seasonsMissingDetails([
        stored(3, 1, { title: 'Return' }),
        stored(1, 1),
        stored(3, 2, { stillPath: null }),
        stored(2, 1, { runtime: null }),
      ]),
    ).toEqual([2, 3]);
  });

  it('updates only episodes that change and keeps what TMDB lacks', () => {
    const updates = episodeDetailsUpdates(
      [
        stored(1, 1, { title: 'Pilot', overview: 'English', stillPath: null }),
        stored(1, 2, { title: 'Second' }),
        stored(1, 3, { title: 'Third', runtime: null }),
      ],
      tmdbSources([
        [
          1,
          [
            tmdb(1, { title: 'Пілот', overview: 'Опис', stillPath: '/1.jpg' }),
            tmdb(2, { overview: 'Інший опис', stillPath: '/other.jpg' }),
            tmdb(3, { runtime: null }),
          ],
        ],
      ]),
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

  it('counts every stored episode of the seasons it asks TMDB about', () => {
    expect(
      storedEpisodeCounts([stored(1, 1), stored(1, 2), stored(2, 1), stored(3, 1)], [1, 3, 4]),
    ).toEqual(
      new Map([
        [1, 2],
        [3, 1],
        [4, 0],
      ]),
    );
  });

  it('matches stored episodes of a renumbered season by English title only', () => {
    const updates = episodeDetailsUpdates(
      [
        stored(5, 1, { title: 'Rise and Shine', stillPath: null }),
        stored(5, 2, { title: 'Waiting', stillPath: null }),
      ],
      tmdbSources(
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

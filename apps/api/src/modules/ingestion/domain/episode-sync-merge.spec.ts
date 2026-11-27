import fc from 'fast-check';

import { addUtcDays, utcDateFromDayId } from '@/common/utils/date.util';

import { fillSeasonAirDates, latestAiredDate, mergeTmdbEpisodeDetails } from './episode-sync-merge';
import { type TmdbSeasonEpisodes } from './models/episode-sources.model';
import { type NormalizedEpisode } from './models/normalized-media.model';

const day = utcDateFromDayId;
const at = (dayId: string, hour: number): Date => addUtcDays(day(dayId), hour / 24);
const NOW = at('20261127', 12);
const NOW_MS = NOW.getTime();
const sources = (localized: [number, NormalizedEpisode[]][]): TmdbSeasonEpisodes => ({
  localized: new Map(localized),
  english: new Map(),
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
      sources([
        [
          1,
          [
            { number: 1, title: 'Пілот', overview: '', runtime: 22, stillPath: '/1.jpg' },
            { number: 2, title: 'Серія 2', overview: 'Другий опис', stillPath: '/2.jpg' },
            { number: 3, title: 'Серія 3', overview: null, rating: 7.5, airDate: day('20020517') },
          ],
        ],
      ]),
      NOW_MS,
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

  it('keeps the TVMaze air time when both sources date the episode', () => {
    const evening = at('20260116', 2);
    const [season] = mergeTmdbEpisodeDetails(
      [{ number: 1, episodes: [{ number: 1, title: 'Pilot', airDate: evening }] }],
      sources([[1, [{ number: 1, title: 'Серія 1', airDate: day('20260115') }]]]),
      NOW_MS,
    );

    expect(season.episodes[0].airDate).toBe(evening);
  });

  it.each([
    ['in the future', day('20261205')],
    ['today', day('20261127')],
    ['yesterday', day('20261126')],
  ])('leaves an undated TVMaze episode undated when the TMDB date is %s', (_case, tmdbDate) => {
    const [season] = mergeTmdbEpisodeDetails(
      [{ number: 1, episodes: [{ number: 1, title: 'Finale', airDate: null }] }],
      sources([[1, [{ number: 1, title: 'Серія 1', airDate: tmdbDate }]]]),
      NOW_MS,
    );

    expect(season.episodes[0].airDate).toBeNull();
  });

  it('takes a TMDB date for an undated episode once it is safely in the past', () => {
    const [season] = mergeTmdbEpisodeDetails(
      [{ number: 1, episodes: [{ number: 1, title: 'Finale', airDate: null }] }],
      sources([[1, [{ number: 1, title: 'Серія 1', airDate: day('20261124') }]]]),
      NOW_MS,
    );

    expect(season.episodes[0].airDate).toEqual(day('20261124'));
  });

  it('leaves seasons and episodes TMDB does not know about', () => {
    const seasons = [
      { number: 1, episodes: [{ number: 9, title: 'Finale' }] },
      { number: 2, episodes: [{ number: 1, title: 'Return' }] },
    ];

    expect(
      mergeTmdbEpisodeDetails(seasons, sources([[1, [{ number: 1, title: 'Пілот' }]]]), NOW_MS),
    ).toEqual(seasons);
  });

  it('never drops a still, runtime or rating that either source has for a paired episode', () => {
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
          sources([[1, [{ number: 1, title: 'Серія 1', ...tmdb }]]]),
          NOW_MS,
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

describe('latestAiredDate', () => {
  it('takes the latest aired regular episode and ignores specials and future episodes', () => {
    expect(
      latestAiredDate(
        [
          { number: 0, episodes: [{ number: 1, title: 'Special', airDate: day('20261120') }] },
          {
            number: 1,
            episodes: [
              { number: 1, title: 'A', airDate: day('20261101') },
              { number: 2, title: 'B', airDate: day('20261110') },
              { number: 3, title: 'C', airDate: day('20261204') },
              { number: 4, title: 'D', airDate: null },
            ],
          },
        ],
        NOW_MS,
      ),
    ).toEqual(day('20261110'));
  });

  it('has no date when nothing has aired', () => {
    expect(
      latestAiredDate(
        [{ number: 1, episodes: [{ number: 1, title: 'A', airDate: null }] }],
        NOW_MS,
      ),
    ).toBeNull();
  });
});

import { utcDateFromDayId } from '@/common/utils/date.util';

import {
  pairTmdbEpisodes,
  renumberedSeasons,
  storedEpisodeCounts,
  tvMazeEpisodeCounts,
} from './episode-pairing';
import { type StoredEpisode } from './models/episode-details.model';
import { type TmdbSeasonEpisodes } from './models/episode-sources.model';
import { type NormalizedEpisode } from './models/normalized-media.model';

const day = utcDateFromDayId;
const sources = (
  localized: [number, NormalizedEpisode[]][],
  english: [number, NormalizedEpisode[]][] = [],
): TmdbSeasonEpisodes => ({ localized: new Map(localized), english: new Map(english) });
const placeholders = (count: number): NormalizedEpisode[] =>
  Array.from({ length: count }, (_, index) => ({ number: index + 1, title: 'Серія' }));
const pairedNumbers = (pairs: Map<number, NormalizedEpisode>): [number, number][] =>
  [...pairs].map(([ours, tmdb]) => [ours, tmdb.number]);

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

  it('counts every stored episode of the seasons it asks TMDB about', () => {
    const stored = (seasonNumber: number, number: number): StoredEpisode => ({
      id: `s${seasonNumber}e${number}`,
      seasonNumber,
      number,
      title: null,
      overview: null,
      airDate: null,
      runtime: null,
      stillPath: null,
      rating: null,
    });

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

  it('flags seasons TMDB numbers with a different episode count', () => {
    expect(
      renumberedSeasons(
        new Map([
          [1, 2],
          [3, 37],
          [4, 5],
        ]),
        new Map([
          [1, placeholders(2)],
          [3, placeholders(40)],
        ]),
      ),
    ).toEqual([3]);
  });
});

describe('pairTmdbEpisodes', () => {
  it('pairs by number when both sources count the season the same', () => {
    const pairs = pairTmdbEpisodes(
      1,
      [
        { number: 1, title: 'Pilot' },
        { number: 2, title: 'Second' },
      ],
      sources([[1, placeholders(2)]]),
    );

    expect(pairedNumbers(pairs)).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('drops a number pair whose air dates are more than two days apart', () => {
    const pairs = pairTmdbEpisodes(
      1,
      [
        { number: 1, title: 'Pilot', airDate: day('20260101') },
        { number: 2, title: 'Second', airDate: day('20260108') },
        { number: 3, title: 'Third', airDate: null },
      ],
      sources([
        [
          1,
          [
            { number: 1, title: 'Серія 1', airDate: day('20260103') },
            { number: 2, title: 'Серія 2', airDate: day('20260111') },
            { number: 3, title: 'Серія 3', airDate: day('20260115') },
          ],
        ],
      ]),
    );

    expect(pairedNumbers(pairs)).toEqual([
      [1, 1],
      [3, 3],
    ]);
  });

  it('pairs a renumbered season by unique English title only', () => {
    const pairs = pairTmdbEpisodes(
      3,
      [
        { number: 1, title: 'The Snowball Effect' },
        { number: 2, title: 'Chimps Ahoy!' },
        { number: 3, title: 'Episode 3' },
        { number: 4, title: 'Gone' },
        { number: 5, title: 'Lost in Translation' },
      ],
      sources(
        [[3, placeholders(6)]],
        [
          [
            3,
            [
              { number: 1, title: 'Chimps Ahoy' },
              { number: 2, title: 'Snowball Effect (Part 1)' },
              { number: 3, title: 'Episode 3' },
              { number: 4, title: 'Gone' },
              { number: 5, title: 'Gone' },
              { number: 6, title: 'Other' },
            ],
          ],
        ],
      ),
    );

    expect(pairedNumbers(pairs)).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it('pairs nothing in a renumbered season without English titles', () => {
    const pairs = pairTmdbEpisodes(
      5,
      [
        { number: 1, title: 'Rise and Shine' },
        { number: 2, title: 'Waiting' },
      ],
      sources([[5, placeholders(1)]]),
    );

    expect(pairs.size).toBe(0);
  });
});

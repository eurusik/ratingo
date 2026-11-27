import {
  episodeTextUpdates,
  localizeSeasons,
  seasonsMissingUkrainianTitles,
  tvMazeSeasonNumbers,
} from './episode-localization';
import { type StoredEpisodeText } from './models/episode-text.model';

describe('tvMazeSeasonNumbers', () => {
  it('picks regular seasons that have TVMaze episodes', () => {
    expect(
      tvMazeSeasonNumbers([
        { number: 0, episodes: [{ number: 1, title: 'Special' }] },
        { number: 1, episodes: [{ tmdbId: 9, number: 1, title: 'Пілот' }] },
        { number: 2, episodes: [{ number: 1, title: 'Return' }] },
        { number: 3, episodes: [] },
      ]),
    ).toEqual([2]);
  });
});

describe('localizeSeasons', () => {
  it('takes each Ukrainian text separately and keeps the rest of the episode', () => {
    const [season] = localizeSeasons(
      [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'Pilot', overview: 'English one', runtime: 50 },
            { number: 2, title: 'Second', overview: 'English two' },
            { number: 3, title: 'Third', overview: null },
          ],
        },
      ],
      new Map([
        [
          1,
          [
            { number: 1, title: 'Пілот', overview: '' },
            { number: 2, title: 'Серія 2', overview: 'Другий опис' },
            { number: 3, title: 'Серія 3', overview: null },
          ],
        ],
      ]),
    );

    expect(season.episodes).toEqual([
      { number: 1, title: 'Пілот', overview: 'English one', runtime: 50 },
      { number: 2, title: 'Second', overview: 'Другий опис' },
      { number: 3, title: 'Third', overview: null },
    ]);
  });

  it('leaves seasons and episodes TMDB does not know about', () => {
    const seasons = [
      { number: 1, episodes: [{ number: 9, title: 'Finale' }] },
      { number: 2, episodes: [{ number: 1, title: 'Return' }] },
    ];

    expect(localizeSeasons(seasons, new Map([[1, [{ number: 1, title: 'Пілот' }]]]))).toEqual(
      seasons,
    );
  });
});

describe('stored episode backfill', () => {
  const stored = (
    seasonNumber: number,
    number: number,
    title: string | null,
    overview: string | null = null,
  ): StoredEpisodeText => ({
    id: `s${seasonNumber}e${number}`,
    seasonNumber,
    number,
    title,
    overview,
  });

  it('lists each season with an untranslated, placeholder or missing title once, in order', () => {
    expect(
      seasonsMissingUkrainianTitles([
        stored(3, 1, 'Return'),
        stored(1, 1, 'Пілот'),
        stored(3, 2, null),
        stored(2, 1, 'Серія 1'),
      ]),
    ).toEqual([2, 3]);
  });

  it('updates only episodes whose text changes and keeps what TMDB lacks', () => {
    const updates = episodeTextUpdates(
      [
        stored(1, 1, 'Pilot', 'English'),
        stored(1, 2, 'Second', 'Вже український опис'),
        stored(1, 3, 'Third', null),
        stored(2, 1, 'Not asked', null),
      ],
      new Map([
        [
          1,
          [
            { number: 1, title: 'Пілот', overview: 'Опис' },
            { number: 2, title: 'Серія 2', overview: 'Вже український опис' },
            { number: 3, title: 'Серія 3', overview: '' },
          ],
        ],
      ]),
    );

    expect(updates).toEqual([
      {
        id: 's1e1',
        title: 'Пілот',
        overview: 'Опис',
        previousTitle: 'Pilot',
        previousOverview: 'English',
      },
    ]);
  });
});

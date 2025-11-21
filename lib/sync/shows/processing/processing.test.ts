import { describe, it, expect } from 'vitest';
import {
  extractSeasonEpisode,
  mergeProviders,
  isAnimeItem,
  prepareShowData,
  prepareRelatedShowData,
} from './processing';

describe('shows/processing/processing', () => {
  it('extractSeasonEpisode обчислює поля з TMDB деталей', () => {
    const tmdbShowData: any = {
      seasons: [
        { season_number: 0, episode_count: 1 },
        { season_number: 2, episode_count: 10 },
        { season_number: 3, episode_count: 8 },
      ],
      last_episode_to_air: { season_number: 3, episode_number: 8, air_date: '2025-01-01' },
      next_episode_to_air: { season_number: 4, episode_number: 1, air_date: '2025-06-01' },
    };
    const info = extractSeasonEpisode(tmdbShowData);
    expect(info.latestSeasonNumber).toBe(3);
    expect(info.latestSeasonEpisodes).toBe(8);
    expect(info.lastEpisodeSeason).toBe(3);
    expect(info.lastEpisodeNumber).toBe(8);
    expect(info.lastEpisodeAirDate).toBe('2025-01-01');
    expect(info.nextEpisodeSeason).toBe(4);
    expect(info.nextEpisodeNumber).toBe(1);
    expect(info.nextEpisodeAirDate).toBe('2025-06-01');
  });

  it('mergeProviders об’єднує провайдерів без дублювань за region:id', () => {
    const a = [{ id: 1, region: 'UA', name: 'A' }];
    const b = [
      { id: 1, region: 'UA', name: 'A' },
      { id: 2, region: 'US', name: 'B' },
    ];
    const merged = mergeProviders(a as any, b as any);
    expect(merged).toHaveLength(2);
    expect(merged.find((p: any) => p.region === 'US' && p.id === 2)).toBeTruthy();
  });

  it('isAnimeItem повертає true за жанром або ключовим словом', () => {
    const detailsGenre: any = { genres: [{ id: 16 }], name: 'X' };
    const translation: any = { titleUk: 'Аніме серіал' };
    expect(isAnimeItem(detailsGenre, null, ['anime', 'аніме'], 16)).toBe(true);
    const detailsNoGenre: any = { genres: [{ id: 10 }], name: 'X' };
    expect(isAnimeItem(detailsNoGenre, translation, ['anime', 'аніме'], 16)).toBe(true);
    expect(isAnimeItem(detailsNoGenre, { titleUk: 'Драма' } as any, ['anime', 'аніме'], 16)).toBe(
      false
    );
  });

  it('prepareShowData мапить поля та обчислювані значення', () => {
    const tmdbShowData: any = {
      id: 123,
      name: 'Title',
      overview: 'Ov',
      poster_path: '/p.jpg',
      backdrop_path: '/b.jpg',
      vote_average: 7.5,
      vote_count: 200,
      popularity: 99.9,
      first_air_date: '2020-01-01',
      status: 'Returning Series',
      tagline: 'Tag',
      number_of_seasons: 3,
      number_of_episodes: 30,
    };
    const ukTranslation: any = { titleUk: 'Назва', overviewUk: 'Опис', posterUk: '/p-uk.jpg' };
    const seasonInfo = extractSeasonEpisode({
      seasons: [],
      last_episode_to_air: null,
      next_episode_to_air: null,
    } as any);
    const show = prepareShowData(
      tmdbShowData,
      ukTranslation,
      [],
      'TV-14',
      null,
      8.1,
      1200,
      80,
      false,
      seasonInfo,
      75,
      100,
      50,
      7.0
    );
    expect(show.tmdbId).toBe(123);
    expect(show.title).toBe('Title');
    expect(show.titleUk).toBe('Назва');
    expect(show.overviewUk).toBe('Опис');
    expect(show.poster).toBe('/p.jpg');
    expect(show.posterUk).toBe('/p-uk.jpg');
    expect(show.backdrop).toBe('/b.jpg');
    expect(show.ratingTmdb).toBe(7.5);
    expect(show.ratingTmdbCount).toBe(200);
    expect(show.popularityTmdb).toBe(99.9);
    expect(show.firstAirDate).toBe('2020-01-01');
    expect(show.status).toBe('Returning Series');
    expect(show.tagline).toBe('Tag');
    expect(show.numberOfSeasons).toBe(3);
    expect(show.numberOfEpisodes).toBe(30);
    expect(show.contentRating).toBe('TV-14');
    expect(show.trendingScore).toBe(75);
    expect(show.delta3m).toBe(100);
    expect(show.watchersDelta).toBe(50);
    expect(show.ratingTrakt).toBe(7.0);
  });

  it('prepareRelatedShowData повертає мінімальні дані для пов’язаного шоу', () => {
    const details: any = {
      id: 555,
      name: 'Rel',
      overview: 'O',
      poster_path: '/p.jpg',
      backdrop_path: '/b.jpg',
      vote_average: 8.0,
      vote_count: 100,
      popularity: 50,
      first_air_date: '2019-01-01',
      status: 'Ended',
      tagline: 'T',
      number_of_seasons: 2,
      number_of_episodes: 20,
    };
    const uk: any = { titleUk: 'UK', overviewUk: 'OU', posterUk: '/p-uk.jpg' };
    const rel = prepareRelatedShowData(details, uk, [], 7.9, 1000, 85);
    expect(rel.tmdbId).toBe(555);
    expect(rel.title).toBe('Rel');
    expect(rel.titleUk).toBe('UK');
    expect(rel.overviewUk).toBe('OU');
    expect(rel.posterUk).toBe('/p-uk.jpg');
    expect(rel.latestSeasonNumber).toBeNull();
    expect(rel.contentRating).toBeNull();
  });
});

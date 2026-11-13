import fc from 'fast-check';
import type { TrendingMedia } from '@/entities/media';
import type { HomeItem, NewEpisode } from '@/shared/api';
import {
  HIGHLIGHTS_PER_TYPE,
  buildHighlights,
  buildHomeHero,
  buildWatchingNow,
  titleIds,
  toAiredAt,
  toEpisodeRelease,
} from './home-feed';

const IMAGE = {
  thumb: 'https://img.test/w154/a.jpg',
  small: 'https://img.test/w342/a.jpg',
  medium: 'https://img.test/w780/a.jpg',
  large: 'https://img.test/w1280/a.jpg',
  original: 'https://img.test/original/a.jpg',
};

function homeItem(id: string, type: HomeItem['type'] = 'show'): HomeItem {
  return {
    id,
    mediaItemId: id,
    type,
    slug: id,
    title: `Title ${id}`,
    originalTitle: `Title ${id}`,
    overview: `About ${id}`,
    poster: IMAGE,
    backdrop: IMAGE,
    stats: { ratingoScore: 80, qualityScore: 80, liveWatchers: 120 },
    externalRatings: {},
    releaseDate: '2025-01-01',
    isNew: false,
    isClassic: false,
  } as unknown as HomeItem;
}

function media(id: string, type: TrendingMedia['type']): TrendingMedia {
  return { mediaItemId: id, type, slug: id, title: id, providers: [] };
}

const mediaIds = (count: number, prefix: string) =>
  fc
    .uniqueArray(fc.integer({ min: 0, max: 50 }), { maxLength: count })
    .map((numbers) => numbers.map((number) => `${prefix}${number}`));

describe('buildHomeHero', () => {
  it('leads with the first title, with its overview and a wide backdrop, and picks the next three', () => {
    const hero = buildHomeHero(['a', 'b', 'c', 'd', 'e'].map((id) => homeItem(id)));

    expect(hero.lead).toMatchObject({
      mediaItemId: 'a',
      overview: 'About a',
      backdropUrl: IMAGE.medium,
      wideBackdropUrl: IMAGE.large,
    });
    expect(hero.picks.map((pick) => pick.mediaItemId)).toEqual(['b', 'c', 'd']);
  });

  it('has nothing to lead with when the feed is empty', () => {
    expect(buildHomeHero([])).toEqual({ lead: undefined, picks: [] });
  });
});

describe('buildWatchingNow', () => {
  it('skips titles already shown above and keeps three', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => homeItem(id));
    const watching = buildWatchingNow(items, titleIds([homeItem('b')]));

    expect(watching.map((item) => item.mediaItemId)).toEqual(['a', 'c', 'd']);
  });
});

describe('buildHighlights', () => {
  it('never repeats a featured title and mixes shows and movies', () => {
    fc.assert(
      fc.property(
        mediaIds(10, 's'),
        mediaIds(10, 'm'),
        fc.uniqueArray(fc.integer({ min: 0, max: 50 }), { maxLength: 6 }),
        (showIds, movieIds, featured) => {
          const excluded = new Set(featured.flatMap((number) => [`s${number}`, `m${number}`]));
          const shows = showIds.map((id) => media(id, 'show'));
          const movies = movieIds.map((id) => media(id, 'movie'));
          const highlights = buildHighlights(shows, movies, excluded);
          const all = [...highlights.all, ...highlights.show, ...highlights.movie];

          expect(all.some((item) => excluded.has(item.mediaItemId))).toBe(false);
          expect(highlights.show.every((item) => item.type === 'show')).toBe(true);
          expect(highlights.movie.every((item) => item.type === 'movie')).toBe(true);
          expect(highlights.all.length).toBeLessThanOrEqual(HIGHLIGHTS_PER_TYPE * 2);
          expect(highlights.show.length).toBeLessThanOrEqual(HIGHLIGHTS_PER_TYPE * 2);
        },
      ),
    );
  });

  it('alternates a show and a movie in the mixed rail', () => {
    const highlights = buildHighlights(
      [media('s1', 'show'), media('s2', 'show')],
      [media('m1', 'movie'), media('m2', 'movie')],
      new Set(),
    );

    expect(highlights.all.map((item) => item.mediaItemId)).toEqual(['s1', 'm1', 's2', 'm2']);
  });
});

describe('new episodes', () => {
  it('turns the API air time into an ISO time every browser parses', () => {
    expect(toAiredAt('2026-11-13 03:00:00')).toBe('2026-11-13T03:00:00Z');
    expect(toAiredAt('2026-11-13T03:00')).toBe('2026-11-13T03:00Z');
    expect(toAiredAt('2026-11-13 03:00:00+00')).toBe('2026-11-13T03:00:00+00:00');
    expect(toAiredAt('2026-11-13 03:00:00.000Z')).toBe('2026-11-13T03:00:00.000Z');
    expect(toAiredAt('2026-11-13T05:00:00+0200')).toBe('2026-11-13T05:00:00+02:00');
    expect(toAiredAt('2026-11-13')).toBe('2026-11-13');
  });

  it('builds a poster address from a TMDB path and keeps full addresses', () => {
    const episode = {
      mediaItemId: 'law',
      slug: 'law-and-order',
      title: 'Закон і порядок',
      posterPath: '/poster.jpg',
      seasonNumber: 26,
      episodeNumber: 6,
      episodeTitle: 'Do No Harm',
      airDate: '2026-11-13 03:00:00',
    } satisfies NewEpisode;

    expect(toEpisodeRelease(episode)).toEqual({
      mediaItemId: 'law',
      slug: 'law-and-order',
      showTitle: 'Закон і порядок',
      episodeTitle: 'Do No Harm',
      posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
      season: 26,
      episode: 6,
      airedAt: '2026-11-13T03:00:00Z',
    });
    expect(toEpisodeRelease({ ...episode, posterPath: 'https://cdn.test/p.jpg' }).posterUrl).toBe(
      'https://cdn.test/p.jpg',
    );
    expect(toEpisodeRelease({ ...episode, posterPath: null }).posterUrl).toBeUndefined();
  });
});

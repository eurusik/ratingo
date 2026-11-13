import fc from 'fast-check';
import type { TrendingMedia } from '@/entities/media';
import type { HomeItem, NewEpisode } from '@/shared/api';
import { buildHomeHero, chooseList, toAiredAt, toEpisodeRelease, toReleaseRail } from './home-feed';

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
    expect(hero.firstPickRank).toBe(2);
  });

  it('has nothing to lead with when the feed is empty', () => {
    expect(buildHomeHero([])).toEqual({ lead: undefined, picks: [], firstPickRank: 1 });
  });
});

describe('toReleaseRail', () => {
  const VERDICTS = ['good', 'mixed', undefined, 'bad'] as const;
  const release = fc.record({
    verdict: fc.constantFrom(...VERDICTS),
    imdbRating: fc.option(fc.double({ min: 1, max: 10, noNaN: true }), { nil: undefined }),
  });

  it('puts better verdicts first and keeps every title once', () => {
    fc.assert(
      fc.property(fc.array(release, { maxLength: 12 }), (specs) => {
        const items: TrendingMedia[] = specs.map((spec, index) => ({
          mediaItemId: String(index),
          type: 'movie',
          slug: String(index),
          title: String(index),
          providers: [],
          ...spec,
        }));
        const rail = toReleaseRail(items);
        const ranks = rail.map((media) => VERDICTS.indexOf(media.verdict));

        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
        expect(rail.map((media) => media.mediaItemId).sort()).toEqual(
          items.map((media) => media.mediaItemId).sort(),
        );
      }),
    );
  });

  it('lifts rated titles above unrated ones with the same verdict and drops the release badge', () => {
    const unrated: TrendingMedia = {
      mediaItemId: 'clay',
      type: 'movie',
      slug: 'clay',
      title: 'Clay',
      verdict: 'good',
      event: 'IN_THEATERS',
      providers: [],
    };
    const rated: TrendingMedia = { ...unrated, mediaItemId: 'digger', criticsPercent: 52 };

    const rail = toReleaseRail([unrated, rated]);

    expect(rail.map((media) => media.mediaItemId)).toEqual(['digger', 'clay']);
    expect(rail.every((media) => media.event === undefined)).toBe(true);
  });
});

describe('chooseList', () => {
  const ORDER = ['show', 'movie'] as const;
  const counts = fc.record({ show: fc.nat({ max: 3 }), movie: fc.nat({ max: 3 }) });

  it('keeps the chosen list while it has titles and otherwise falls back to the first one that does', () => {
    fc.assert(
      fc.property(counts, fc.constantFrom(...ORDER), (sizes, chosen) => {
        const lists = { show: Array(sizes.show).fill(0), movie: Array(sizes.movie).fill(0) };
        const { available, active } = chooseList(lists, ORDER, chosen);

        expect(available).toEqual(ORDER.filter((key) => sizes[key] > 0));
        if (sizes[chosen] > 0) expect(active).toBe(chosen);
        else expect(active).toBe(available[0]);
      }),
    );
  });

  it('has nothing to show when every list is empty', () => {
    expect(chooseList({ show: [], movie: [] }, ORDER, 'show')).toEqual({
      available: [],
      active: undefined,
    });
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

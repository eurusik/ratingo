import { buildRobots, buildSitemap } from './crawling';

const SITE_URL = 'https://ratingo.top';

describe('buildRobots', () => {
  it('allows indexing and exposes the sitemap on the production site', () => {
    const result = buildRobots(SITE_URL, true);

    expect(result.rules).toEqual([expect.objectContaining({ userAgent: '*', allow: '/' })]);
    expect(result.sitemap).toBe('https://ratingo.top/sitemap.xml');
  });

  it('keeps private and service-worker paths out of the index', () => {
    const [rule] = [buildRobots(SITE_URL, true).rules].flat();

    expect(rule?.disallow).toEqual(
      expect.arrayContaining(['/auth', '/my', '/~offline', '/serwist']),
    );
  });

  it('lets crawlers reach the public calendar', () => {
    const [rule] = [buildRobots(SITE_URL, true).rules].flat();

    expect(rule?.disallow).not.toContain('/calendar');
  });

  it('blocks all crawling anywhere else', () => {
    const result = buildRobots(SITE_URL, false);

    expect(result.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(result.sitemap).toBeUndefined();
  });
});

describe('buildSitemap', () => {
  const sitemap = buildSitemap(SITE_URL, {
    browseCategories: ['shows-trending', 'movies-trending'],
    movies: [{ slug: 'tenet-2020', updatedAt: '2026-01-02T00:00:00.000Z' }],
    shows: [{ slug: 'outlander-2014', updatedAt: '2026-03-04T00:00:00.000Z' }],
  });

  it('lists the home page first with top priority', () => {
    expect(sitemap[0]).toEqual({
      url: SITE_URL,
      changeFrequency: 'daily',
      priority: 1,
    });
  });

  it('adds movie and show pages with their own dates', () => {
    expect(sitemap.slice(-2)).toEqual([
      {
        url: 'https://ratingo.top/movies/tenet-2020',
        lastModified: new Date('2026-01-02T00:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 0.7,
      },
      {
        url: 'https://ratingo.top/shows/outlander-2014',
        lastModified: new Date('2026-03-04T00:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 0.7,
      },
    ]);
  });

  it('lists the calendar and each browse category at its canonical URL', () => {
    const urls = sitemap.map((entry) => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        'https://ratingo.top/calendar',
        'https://ratingo.top/browse/shows-trending',
        'https://ratingo.top/browse/movies-trending',
      ]),
    );
    expect(urls).not.toContain('https://ratingo.top/browse');
  });

  it('gives a change date only to pages that know when they changed', () => {
    const undated = sitemap.filter((entry) => !entry.url.match(/\/(movies|shows)\//));

    expect(undated.length).toBeGreaterThan(0);
    expect(undated.every((entry) => entry.lastModified === undefined)).toBe(true);
  });

  it('leaves the journal out until it is ported', () => {
    expect(sitemap.some((entry) => entry.url.includes('/journal'))).toBe(false);
  });

  it('never lists the same URL twice', () => {
    const urls = sitemap.map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
  });
});

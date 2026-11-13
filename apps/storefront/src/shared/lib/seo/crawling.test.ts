import { buildRobots, buildSitemap } from './crawling';

const SITE_URL = 'https://ratingo.top';
const NOW = new Date('2026-11-13T00:00:00.000Z');

describe('buildRobots', () => {
  it('allows indexing and exposes the sitemap on the production site', () => {
    const result = buildRobots(SITE_URL, true);

    expect(result.rules).toEqual([expect.objectContaining({ userAgent: '*', allow: '/' })]);
    expect(result.sitemap).toBe('https://ratingo.top/sitemap.xml');
  });

  it('keeps private and service-worker paths out of the index', () => {
    const [rule] = [buildRobots(SITE_URL, true).rules].flat();

    expect(rule?.disallow).toEqual(expect.arrayContaining(['/auth', '/my', '/~offline', '/serwist']));
  });

  it('blocks all crawling anywhere else', () => {
    const result = buildRobots(SITE_URL, false);

    expect(result.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(result.sitemap).toBeUndefined();
  });
});

describe('buildSitemap', () => {
  const sitemap = buildSitemap(SITE_URL, {
    now: NOW,
    movies: [{ slug: 'tenet-2020', updatedAt: '2026-01-02T00:00:00.000Z' }],
    shows: [{ slug: 'outlander-2014', updatedAt: '2026-03-04T00:00:00.000Z' }],
    journalPosts: [{ slug: 'shcho-novoho', publishedAt: '2026-05-06T00:00:00.000Z' }],
  });

  it('lists the home page first with top priority', () => {
    expect(sitemap[0]).toEqual({
      url: SITE_URL,
      lastModified: NOW,
      changeFrequency: 'daily',
      priority: 1,
    });
  });

  it('adds journal, movie and show pages with their own dates', () => {
    expect(sitemap.slice(-3)).toEqual([
      {
        url: 'https://ratingo.top/journal/shcho-novoho',
        lastModified: new Date('2026-05-06T00:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 0.7,
      },
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

  it('never lists the same URL twice', () => {
    const urls = sitemap.map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
  });
});

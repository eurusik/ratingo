import type { MetadataRoute } from 'next';

const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

async function loadRobots(vercelEnv: string | undefined): Promise<MetadataRoute.Robots> {
  if (vercelEnv === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = vercelEnv;
  }

  let robots: () => MetadataRoute.Robots = () => ({ rules: [] });
  await jest.isolateModulesAsync(async () => {
    robots = (await import('../robots')).default;
  });
  return robots();
}

describe('robots', () => {
  afterEach(() => {
    if (ORIGINAL_VERCEL_ENV === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
    }
  });

  it('allows indexing and exposes the sitemap in production', async () => {
    const result = await loadRobots('production');

    expect(result.rules).toEqual([expect.objectContaining({ userAgent: '*', allow: '/' })]);
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it.each(['preview', 'development', undefined])('blocks all crawling when VERCEL_ENV is %s', async (vercelEnv) => {
    const result = await loadRobots(vercelEnv);

    expect(result.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(result.sitemap).toBeUndefined();
  });
});

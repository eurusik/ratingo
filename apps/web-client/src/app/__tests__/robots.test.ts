import type { MetadataRoute } from 'next';

const ORIGINAL_APP_ENV = process.env.APP_ENV;

function setAppEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env.APP_ENV;
  } else {
    process.env.APP_ENV = value;
  }
}

async function loadRobots(appEnv: string | undefined): Promise<MetadataRoute.Robots> {
  setAppEnv(appEnv);

  let robots: () => MetadataRoute.Robots = () => ({ rules: [] });
  await jest.isolateModulesAsync(async () => {
    robots = (await import('../robots')).default;
  });
  return robots();
}

describe('robots', () => {
  afterEach(() => {
    setAppEnv(ORIGINAL_APP_ENV);
  });

  it('allows indexing and exposes the sitemap in production', async () => {
    const result = await loadRobots('production');

    expect(result.rules).toEqual([expect.objectContaining({ userAgent: '*', allow: '/' })]);
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it.each(['dev', 'ci', 'development', undefined])('blocks all crawling when APP_ENV is %s', async (appEnv) => {
    const result = await loadRobots(appEnv);

    expect(result.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(result.sitemap).toBeUndefined();
  });
});

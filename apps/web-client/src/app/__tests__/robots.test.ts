import type { MetadataRoute } from 'next';

const ENV_KEYS = ['APP_ENV', 'VERCEL_ENV'] as const;
type EnvKey = (typeof ENV_KEYS)[number];
type DeployEnv = Partial<Record<EnvKey, string>>;

const ORIGINAL_ENV: DeployEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function applyEnv(env: DeployEnv) {
  for (const key of ENV_KEYS) {
    const value = env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function loadRobots(env: DeployEnv): Promise<MetadataRoute.Robots> {
  applyEnv(env);

  let robots: () => MetadataRoute.Robots = () => ({ rules: [] });
  await jest.isolateModulesAsync(async () => {
    robots = (await import('../robots')).default;
  });
  return robots();
}

describe('robots', () => {
  afterEach(() => {
    applyEnv(ORIGINAL_ENV);
  });

  it.each<DeployEnv>([{ APP_ENV: 'production' }, { VERCEL_ENV: 'production' }])(
    'allows indexing and exposes the sitemap in production (%o)',
    async (env) => {
      const result = await loadRobots(env);

      expect(result.rules).toEqual([expect.objectContaining({ userAgent: '*', allow: '/' })]);
      expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
    },
  );

  it.each<DeployEnv>([
    { APP_ENV: 'dev' },
    { APP_ENV: 'development' },
    { VERCEL_ENV: 'preview' },
    { VERCEL_ENV: 'development' },
    {},
  ])('blocks all crawling outside production (%o)', async (env) => {
    const result = await loadRobots(env);

    expect(result.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(result.sitemap).toBeUndefined();
  });
});

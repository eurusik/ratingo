const ORIGINAL_ENV = process.env;

interface DeploymentEnv {
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
}

function loadEnv(deployment: DeploymentEnv): typeof import('./env') {
  process.env = { ...ORIGINAL_ENV, ...deployment };
  let env: typeof import('./env') | undefined;
  jest.isolateModules(() => {
    env = jest.requireActual<typeof import('./env')>('./env');
  });
  return env as typeof import('./env');
}

describe('site environment gating', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('treats only the ratingo.top production deployment as the production site', () => {
    const env = loadEnv({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'ratingo.top' });

    expect(env.IS_PRODUCTION_SITE).toBe(true);
    expect(env.GA_MEASUREMENT_ID).toBe('G-MPY73Y7DBB');
  });

  it.each<[string, DeploymentEnv]>([
    ['the storefront dev domain', { VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'ratingo-storefront.vercel.app' }],
    ['a preview', { VERCEL_ENV: 'preview', VERCEL_PROJECT_PRODUCTION_URL: 'ratingo.top' }],
    ['a local build', {}],
  ])('keeps %s out of search and analytics', (_name, deployment) => {
    const env = loadEnv({ ...deployment, NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-OVERRIDE' });

    expect(env.IS_PRODUCTION_SITE).toBe(false);
    expect(env.GA_MEASUREMENT_ID).toBeNull();
  });

  it('lets the production site override the analytics property', () => {
    const env = loadEnv({
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'ratingo.top',
      NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-OVERRIDE',
    });

    expect(env.GA_MEASUREMENT_ID).toBe('G-OVERRIDE');
  });
});

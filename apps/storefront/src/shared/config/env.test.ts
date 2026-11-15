const ORIGINAL_ENV = process.env;

interface DeploymentEnv {
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
  NEXT_PUBLIC_API_URL?: string;
  API_INTERNAL_URL?: string;
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
    [
      'the storefront dev domain',
      { VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'ratingo-storefront.vercel.app' },
    ],
    ['a preview', { VERCEL_ENV: 'preview', VERCEL_PROJECT_PRODUCTION_URL: 'ratingo.top' }],
    ['a local build', {}],
  ])('keeps %s out of search and Google Analytics', (_name, deployment) => {
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

describe('API origins', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('sends server requests over the private network when API_INTERNAL_URL is set', () => {
    const env = loadEnv({
      NEXT_PUBLIC_API_URL: 'https://api-dev.ratingo.top',
      API_INTERNAL_URL: 'http://ratingo.railway.internal:8080/',
    });

    expect(env.API_BASE_URL).toBe('https://api-dev.ratingo.top/api');
    expect(env.SERVER_API_BASE_URL).toBe('http://ratingo.railway.internal:8080/api');
  });

  it.each([undefined, ''])(
    'falls back to the public API when API_INTERNAL_URL is %p',
    (internal) => {
      const env = loadEnv({
        NEXT_PUBLIC_API_URL: 'https://api-dev.ratingo.top',
        API_INTERNAL_URL: internal,
      });

      expect(env.SERVER_API_BASE_URL).toBe('https://api-dev.ratingo.top/api');
    },
  );
});

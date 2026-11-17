const ORIGINAL_ENV = process.env;

interface DeploymentEnv {
  APP_ENV?: string;
  NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
  NEXT_PUBLIC_CLARITY_PROJECT_ID?: string;
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

  it('treats only the production deployment as the production site', () => {
    const env = loadEnv({ APP_ENV: 'production' });

    expect(env.IS_PRODUCTION_SITE).toBe(true);
    expect(env.GA_MEASUREMENT_ID).toBe('G-Y3TXZS9VBK');
    expect(env.CLARITY_PROJECT_ID).toBe('zf60w3prn8');
  });

  it.each<[string, DeploymentEnv]>([
    ['the dev deployment', { APP_ENV: 'dev' }],
    ['a CI build', { APP_ENV: 'ci' }],
    ['a local build', {}],
  ])('keeps %s out of search, Google Analytics and Clarity', (_name, deployment) => {
    const env = loadEnv({
      ...deployment,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-OVERRIDE',
      NEXT_PUBLIC_CLARITY_PROJECT_ID: 'override',
    });

    expect(env.IS_PRODUCTION_SITE).toBe(false);
    expect(env.GA_MEASUREMENT_ID).toBeNull();
    expect(env.CLARITY_PROJECT_ID).toBeNull();
  });

  it('lets the production site override the analytics property', () => {
    const env = loadEnv({
      APP_ENV: 'production',
      NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-OVERRIDE',
    });

    expect(env.GA_MEASUREMENT_ID).toBe('G-OVERRIDE');
  });

  it('lets the production site override the Clarity project', () => {
    const env = loadEnv({
      APP_ENV: 'production',
      NEXT_PUBLIC_CLARITY_PROJECT_ID: 'override',
    });

    expect(env.CLARITY_PROJECT_ID).toBe('override');
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

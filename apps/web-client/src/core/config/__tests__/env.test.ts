const ORIGINAL = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
};

function setEnv(key: keyof typeof ORIGINAL, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

async function loadEnv() {
  let loaded: typeof import('../env').env | undefined;
  await jest.isolateModulesAsync(async () => {
    loaded = (await import('../env')).env;
  });
  return loaded!;
}

describe('env API base URLs', () => {
  afterEach(() => {
    setEnv('NEXT_PUBLIC_API_URL', ORIGINAL.NEXT_PUBLIC_API_URL);
    setEnv('API_INTERNAL_URL', ORIGINAL.API_INTERNAL_URL);
  });

  it('uses the private API origin for server requests when API_INTERNAL_URL is set', async () => {
    setEnv('NEXT_PUBLIC_API_URL', 'https://api.ratingo.top');
    setEnv('API_INTERNAL_URL', 'http://ratingo.railway.internal:8080');

    const env = await loadEnv();

    expect(env.API_BASE_URL).toBe('https://api.ratingo.top/api');
    expect(env.SERVER_API_BASE_URL).toBe('http://ratingo.railway.internal:8080/api');
  });

  it.each([undefined, ''])('falls back to the public API origin when API_INTERNAL_URL is %p', async (internal) => {
    setEnv('NEXT_PUBLIC_API_URL', 'https://api.ratingo.top');
    setEnv('API_INTERNAL_URL', internal);

    const env = await loadEnv();

    expect(env.SERVER_API_BASE_URL).toBe('https://api.ratingo.top/api');
  });
});

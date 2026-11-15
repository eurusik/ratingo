function mockKyGet(body: unknown) {
  jest.doMock('ky', () => {
    const mockInstance = {
      get: jest.fn(() => ({ json: jest.fn().mockResolvedValue(body) })),
      post: jest.fn(),
      patch: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };
    return Object.assign(
      jest.fn(() => mockInstance),
      { create: jest.fn(() => mockInstance) },
    );
  });
  jest.doMock('../../auth/refresh', () => ({
    refreshTokens: jest.fn(),
    isRefreshEndpoint: jest.fn(() => false),
  }));
  jest.doMock('../../auth/token-storage', () => ({
    tokenStorage: { clearTokens: jest.fn() },
  }));
}

async function loadClient() {
  const client = await import('../client');
  client.configureApiClient({ baseUrl: 'http://localhost:3001' });
  return client;
}

describe('apiGetOrNull', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when the API succeeds with no data', async () => {
    mockKyGet({ success: true, data: null });
    const { apiGetOrNull } = await loadClient();

    await expect(apiGetOrNull('user-media/1')).resolves.toBeNull();
  });

  it('returns the data when the API has it', async () => {
    mockKyGet({ success: true, data: { rating: 80 } });
    const { apiGetOrNull } = await loadClient();

    await expect(apiGetOrNull('user-media/1')).resolves.toEqual({ rating: 80 });
  });

  it('throws the API error when the request fails', async () => {
    mockKyGet({
      success: false,
      error: { code: 'FORBIDDEN', message: 'no', statusCode: 403 },
    });
    const { apiGetOrNull } = await loadClient();
    const { ApiError } = await import('../error');

    await expect(apiGetOrNull('user-media/1')).rejects.toBeInstanceOf(ApiError);
  });
});

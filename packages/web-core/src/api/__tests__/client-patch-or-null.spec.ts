export {};

function mockKyPatch(body: unknown) {
  jest.doMock('ky', () => {
    const mockInstance = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(() => ({ json: jest.fn().mockResolvedValue(body) })),
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

describe('apiPatchOrNull', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when the update leaves nothing behind', async () => {
    mockKyPatch({ success: true, data: null });
    const { apiPatchOrNull } = await loadClient();

    await expect(apiPatchOrNull('user-media/1', { rating: null })).resolves.toBeNull();
  });

  it('returns the updated data', async () => {
    mockKyPatch({ success: true, data: { rating: 80 } });
    const { apiPatchOrNull } = await loadClient();

    await expect(apiPatchOrNull('user-media/1', { rating: 80 })).resolves.toEqual({ rating: 80 });
  });

  it('throws the API error when the request fails', async () => {
    mockKyPatch({
      success: false,
      error: { code: 'FORBIDDEN', message: 'no', statusCode: 403 },
    });
    const { apiPatchOrNull } = await loadClient();
    const { ApiError } = await import('../error');

    await expect(apiPatchOrNull('user-media/1', { rating: 1 })).rejects.toBeInstanceOf(ApiError);
  });
});

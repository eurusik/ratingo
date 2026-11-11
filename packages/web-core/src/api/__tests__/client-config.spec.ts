describe('configureApiClient', () => {
  const okResponse = { success: true, data: { ok: true } };

  async function loadClient() {
    const instance = { get: jest.fn(() => ({ json: jest.fn().mockResolvedValue(okResponse) })) };
    const create = jest.fn(() => instance);
    jest.doMock('ky', () => Object.assign(jest.fn(), { create }));
    jest.doMock('../../auth/refresh', () => ({ refreshTokens: jest.fn(), isRefreshEndpoint: jest.fn() }));
    jest.doMock('../../auth/token-storage', () => ({ tokenStorage: { clearTokens: jest.fn() } }));
    const client = await import('../client');
    return { ...client, create };
  }

  beforeEach(() => {
    jest.resetModules();
  });

  it('rejects requests until a base URL is configured', async () => {
    const { apiGet } = await loadClient();

    await expect(apiGet('catalog/movies')).rejects.toThrow('API client is not configured');
  });

  it('keeps the existing client when configured again with the same base URL', async () => {
    const { apiGet, configureApiClient, create } = await loadClient();

    configureApiClient({ baseUrl: 'http://localhost:3001/api' });
    await apiGet('catalog/movies');
    configureApiClient({ baseUrl: 'http://localhost:3001/api' });
    await apiGet('catalog/movies');

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the client with the new prefix when the base URL changes', async () => {
    const { apiGet, configureApiClient, create } = await loadClient();

    configureApiClient({ baseUrl: 'http://localhost:3001/api' });
    await apiGet('catalog/movies');
    configureApiClient({ baseUrl: 'https://api.ratingo.top/api' });
    await apiGet('catalog/movies');

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ prefixUrl: 'https://api.ratingo.top/api' }),
    );
  });
});

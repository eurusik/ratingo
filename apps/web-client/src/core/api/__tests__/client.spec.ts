/**
 * Tests for API client 204 No Content handling.
 *
 * These tests verify that POST and DELETE properly handle
 * 204 No Content responses without trying to parse JSON.
 */

describe('API Client 204 Handling', () => {
  // Reset modules before each test to get fresh client instance
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('apiPost returns undefined for 204 No Content', async () => {
    // Mock ky before importing client
    jest.doMock('ky', () => {
      const mockInstance = {
        post: jest.fn().mockResolvedValue({
          status: 204,
          json: jest.fn().mockRejectedValue(new Error('Should not be called')),
        }),
        get: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
      };

      const ky = jest.fn(() => mockInstance);
      ky.create = jest.fn(() => mockInstance);
      return ky;
    });

    jest.doMock('../../config/env', () => ({
      env: { API_BASE_URL: 'http://localhost:3001' },
    }));

    jest.doMock('../../auth/refresh', () => ({
      refreshTokens: jest.fn(),
      isRefreshEndpoint: jest.fn(() => false),
    }));

    jest.doMock('../../auth/token-storage', () => ({
      tokenStorage: { clearTokens: jest.fn() },
    }));

    const { apiPost } = await import('../client');
    const result = await apiPost<void>('user-media/episodes/123/watch');

    expect(result).toBeUndefined();
  });

  it('apiPost parses JSON for non-204 responses', async () => {
    const mockData = { id: '123', name: 'Test' };

    jest.doMock('ky', () => {
      const mockInstance = {
        post: jest.fn().mockResolvedValue({
          status: 200,
          json: jest.fn().mockResolvedValue({ success: true, data: mockData }),
        }),
        get: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
      };

      const ky = jest.fn(() => mockInstance);
      ky.create = jest.fn(() => mockInstance);
      return ky;
    });

    jest.doMock('../../config/env', () => ({
      env: { API_BASE_URL: 'http://localhost:3001' },
    }));

    jest.doMock('../../auth/refresh', () => ({
      refreshTokens: jest.fn(),
      isRefreshEndpoint: jest.fn(() => false),
    }));

    jest.doMock('../../auth/token-storage', () => ({
      tokenStorage: { clearTokens: jest.fn() },
    }));

    const { apiPost } = await import('../client');
    const result = await apiPost<typeof mockData>('test/endpoint', { name: 'Test' });

    expect(result).toEqual(mockData);
  });

  it('apiDelete returns undefined for 204 No Content', async () => {
    jest.doMock('ky', () => {
      const mockInstance = {
        delete: jest.fn().mockResolvedValue({
          status: 204,
          json: jest.fn().mockRejectedValue(new Error('Should not be called')),
        }),
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
      };

      const ky = jest.fn(() => mockInstance);
      ky.create = jest.fn(() => mockInstance);
      return ky;
    });

    jest.doMock('../../config/env', () => ({
      env: { API_BASE_URL: 'http://localhost:3001' },
    }));

    jest.doMock('../../auth/refresh', () => ({
      refreshTokens: jest.fn(),
      isRefreshEndpoint: jest.fn(() => false),
    }));

    jest.doMock('../../auth/token-storage', () => ({
      tokenStorage: { clearTokens: jest.fn() },
    }));

    const { apiDelete } = await import('../client');
    const result = await apiDelete('user-media/episodes/123/watch');

    expect(result).toBeUndefined();
  });

  it('apiDelete parses JSON for non-204 responses', async () => {
    const mockData = { deleted: true };

    jest.doMock('ky', () => {
      const mockInstance = {
        delete: jest.fn().mockResolvedValue({
          status: 200,
          json: jest.fn().mockResolvedValue({ success: true, data: mockData }),
        }),
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
      };

      const ky = jest.fn(() => mockInstance);
      ky.create = jest.fn(() => mockInstance);
      return ky;
    });

    jest.doMock('../../config/env', () => ({
      env: { API_BASE_URL: 'http://localhost:3001' },
    }));

    jest.doMock('../../auth/refresh', () => ({
      refreshTokens: jest.fn(),
      isRefreshEndpoint: jest.fn(() => false),
    }));

    jest.doMock('../../auth/token-storage', () => ({
      tokenStorage: { clearTokens: jest.fn() },
    }));

    const { apiDelete } = await import('../client');
    const result = await apiDelete<typeof mockData>('test/endpoint');

    expect(result).toEqual(mockData);
  });
});

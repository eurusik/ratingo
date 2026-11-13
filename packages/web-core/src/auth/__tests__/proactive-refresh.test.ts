/**
 * Tests for proactive token refresh.
 */

import {
  scheduleProactiveRefresh,
  cancelProactiveRefresh,
  getTimeUntilRefresh,
} from '../proactive-refresh';
import { tokenStorage } from '../token-storage';
import { refreshTokens } from '../refresh';

// Mock dependencies
jest.mock('../token-storage', () => ({
  tokenStorage: {
    getAccessToken: jest.fn(),
  },
}));

jest.mock('../refresh', () => ({
  refreshTokens: jest.fn(),
}));

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

import { jwtDecode } from 'jwt-decode';

const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockRefreshTokens = refreshTokens as jest.MockedFunction<typeof refreshTokens>;
const mockJwtDecode = jwtDecode as jest.MockedFunction<typeof jwtDecode>;

describe('Proactive Refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    cancelProactiveRefresh();
  });

  afterEach(() => {
    jest.useRealTimers();
    cancelProactiveRefresh();
  });

  describe('scheduleProactiveRefresh', () => {
    it('should not schedule refresh when no access token', () => {
      mockTokenStorage.getAccessToken.mockReturnValue(null);

      scheduleProactiveRefresh();

      jest.advanceTimersByTime(100000);
      expect(mockRefreshTokens).not.toHaveBeenCalled();
    });

    it('should schedule refresh 60 seconds before token expiration', () => {
      const now = Date.now();
      const expiresIn = 5 * 60 * 1000; // 5 minutes
      const exp = Math.floor((now + expiresIn) / 1000);

      mockTokenStorage.getAccessToken.mockReturnValue('valid-token');
      mockJwtDecode.mockReturnValue({ exp });
      mockRefreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      scheduleProactiveRefresh();

      // Should not refresh immediately
      expect(mockRefreshTokens).not.toHaveBeenCalled();

      // Advance to 60 seconds before expiration (4 minutes)
      jest.advanceTimersByTime(4 * 60 * 1000);

      expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    });

    it('should use minimum delay when token is about to expire', () => {
      const now = Date.now();
      const exp = Math.floor((now + 30 * 1000) / 1000); // Expires in 30 seconds

      mockTokenStorage.getAccessToken.mockReturnValue('valid-token');
      mockJwtDecode.mockReturnValue({ exp });
      mockRefreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      scheduleProactiveRefresh();

      // Should use minimum delay (5 seconds)
      jest.advanceTimersByTime(5000);

      expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous timer when called again', () => {
      const now = Date.now();
      const exp = Math.floor((now + 10 * 60 * 1000) / 1000); // 10 minutes

      mockTokenStorage.getAccessToken.mockReturnValue('valid-token');
      mockJwtDecode.mockReturnValue({ exp });
      mockRefreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      // Schedule first
      scheduleProactiveRefresh();

      // Schedule again (should cancel first)
      scheduleProactiveRefresh();

      // Advance past first scheduled time
      jest.advanceTimersByTime(9 * 60 * 1000);

      // Should only call once (second schedule)
      expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid token gracefully', () => {
      mockTokenStorage.getAccessToken.mockReturnValue('invalid-token');
      mockJwtDecode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Should not throw
      expect(() => scheduleProactiveRefresh()).not.toThrow();
      expect(mockRefreshTokens).not.toHaveBeenCalled();
    });

    it('should schedule next refresh after successful refresh', async () => {
      const now = Date.now();
      const exp1 = Math.floor((now + 2 * 60 * 1000) / 1000); // 2 minutes
      const exp2 = Math.floor((now + 7 * 60 * 1000) / 1000); // 7 minutes (after refresh)

      mockTokenStorage.getAccessToken
        .mockReturnValueOnce('token-1')
        .mockReturnValueOnce('token-2');
      mockJwtDecode
        .mockReturnValueOnce({ exp: exp1 })
        .mockReturnValueOnce({ exp: exp2 });
      mockRefreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      scheduleProactiveRefresh();

      // First refresh at 1 minute (2min - 60s buffer)
      jest.advanceTimersByTime(60 * 1000);
      await Promise.resolve(); // Let async complete

      expect(mockRefreshTokens).toHaveBeenCalledTimes(1);

      // Second refresh should be scheduled
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();

      expect(mockRefreshTokens).toHaveBeenCalledTimes(2);
    });

    it('should not retry on refresh failure', async () => {
      const now = Date.now();
      const exp = Math.floor((now + 2 * 60 * 1000) / 1000);

      mockTokenStorage.getAccessToken.mockReturnValue('valid-token');
      mockJwtDecode.mockReturnValue({ exp });
      mockRefreshTokens.mockRejectedValue(new Error('Refresh failed'));

      scheduleProactiveRefresh();

      jest.advanceTimersByTime(60 * 1000);
      await Promise.resolve();

      expect(mockRefreshTokens).toHaveBeenCalledTimes(1);

      // Should not schedule another refresh after failure
      jest.advanceTimersByTime(60 * 1000);
      await Promise.resolve();

      expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelProactiveRefresh', () => {
    it('should cancel scheduled refresh', () => {
      const now = Date.now();
      const exp = Math.floor((now + 5 * 60 * 1000) / 1000);

      mockTokenStorage.getAccessToken.mockReturnValue('valid-token');
      mockJwtDecode.mockReturnValue({ exp });

      scheduleProactiveRefresh();
      cancelProactiveRefresh();

      jest.advanceTimersByTime(10 * 60 * 1000);

      expect(mockRefreshTokens).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        cancelProactiveRefresh();
        cancelProactiveRefresh();
        cancelProactiveRefresh();
      }).not.toThrow();
    });
  });

  describe('getTimeUntilRefresh', () => {
    it('should return null when no access token', () => {
      mockTokenStorage.getAccessToken.mockReturnValue(null);

      expect(getTimeUntilRefresh()).toBeNull();
    });

    it('should return time until refresh', () => {
      const now = Date.now();
      const expiresIn = 5 * 60 * 1000; // 5 minutes
      const exp = Math.floor((now + expiresIn) / 1000);

      mockTokenStorage.getAccessToken.mockReturnValue('valid-token');
      mockJwtDecode.mockReturnValue({ exp });

      const timeUntilRefresh = getTimeUntilRefresh();

      // Should be approximately 4 minutes (5min - 60s buffer)
      expect(timeUntilRefresh).toBeGreaterThan(3.9 * 60 * 1000);
      expect(timeUntilRefresh).toBeLessThan(4.1 * 60 * 1000);
    });

    it('should return 0 when token is expired', () => {
      const now = Date.now();
      const exp = Math.floor((now - 60 * 1000) / 1000); // Expired 1 minute ago

      mockTokenStorage.getAccessToken.mockReturnValue('valid-token');
      mockJwtDecode.mockReturnValue({ exp });

      expect(getTimeUntilRefresh()).toBe(0);
    });

    it('should return null for invalid token', () => {
      mockTokenStorage.getAccessToken.mockReturnValue('invalid-token');
      mockJwtDecode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(getTimeUntilRefresh()).toBeNull();
    });
  });
});

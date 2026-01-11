import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GoogleAuthGuard } from './google-auth.guard';

describe('GoogleAuthGuard - returnTo Validation', () => {
  let guard: GoogleAuthGuard;

  const googleConfig = {
    enabled: true,
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    callbackUrl: 'http://localhost:3000/api/auth/google/callback',
  };

  const authConfig = {
    stateSecret: 'test-state-secret-that-is-long-enough',
  };

  beforeEach(() => {
    guard = new GoogleAuthGuard(googleConfig as any, authConfig as any);
  });

  describe('validateReturnTo (via state generation)', () => {
    // Access private method through state generation
    const getReturnToFromState = (guard: GoogleAuthGuard, returnTo?: string): string => {
      // Use reflection to access private method
      const validateReturnTo = (guard as any).validateReturnTo.bind(guard);
      return validateReturnTo(returnTo) || '/';
    };

    it('should accept valid relative paths', () => {
      expect(getReturnToFromState(guard, '/home')).toBe('/home');
      expect(getReturnToFromState(guard, '/users/123')).toBe('/users/123');
      expect(getReturnToFromState(guard, '/search?q=test')).toBe('/search?q=test');
      expect(getReturnToFromState(guard, '/path/to/page')).toBe('/path/to/page');
    });

    it('should accept paths with query parameters', () => {
      expect(getReturnToFromState(guard, '/search?q=test&page=1')).toBe('/search?q=test&page=1');
      expect(getReturnToFromState(guard, '/filter?category=books')).toBe('/filter?category=books');
    });

    it('should accept paths with dots', () => {
      expect(getReturnToFromState(guard, '/file.html')).toBe('/file.html');
      expect(getReturnToFromState(guard, '/api/v1.0/users')).toBe('/api/v1.0/users');
    });

    it('should accept paths with hyphens and underscores', () => {
      expect(getReturnToFromState(guard, '/my-page')).toBe('/my-page');
      expect(getReturnToFromState(guard, '/my_page')).toBe('/my_page');
      expect(getReturnToFromState(guard, '/user-profile/settings')).toBe('/user-profile/settings');
    });

    it('should reject protocol-relative URLs (//)', () => {
      expect(getReturnToFromState(guard, '//evil.com')).toBe('/');
      expect(getReturnToFromState(guard, '//evil.com/path')).toBe('/');
    });

    it('should reject absolute URLs with protocol', () => {
      expect(getReturnToFromState(guard, 'http://evil.com')).toBe('/');
      expect(getReturnToFromState(guard, 'https://evil.com')).toBe('/');
      expect(getReturnToFromState(guard, 'javascript:alert(1)')).toBe('/');
    });

    it('should reject paths not starting with /', () => {
      expect(getReturnToFromState(guard, 'home')).toBe('/');
      expect(getReturnToFromState(guard, 'path/to/page')).toBe('/');
    });

    it('should return default "/" for empty or undefined returnTo', () => {
      expect(getReturnToFromState(guard, '')).toBe('/');
      expect(getReturnToFromState(guard, undefined)).toBe('/');
    });

    it('should reject paths with invalid characters', () => {
      expect(getReturnToFromState(guard, '/path<script>')).toBe('/');
      expect(getReturnToFromState(guard, '/path"test')).toBe('/');
      expect(getReturnToFromState(guard, "/path'test")).toBe('/');
    });
  });

  describe('canActivate - feature toggle', () => {
    it('should throw NotFoundException when Google OAuth is disabled', async () => {
      const disabledGuard = new GoogleAuthGuard(
        { ...googleConfig, enabled: false } as any,
        authConfig as any,
      );

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ query: {} }),
          getResponse: () => ({}),
        }),
      } as any;

      await expect(disabledGuard.canActivate(mockContext)).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleRequest', () => {
    it('should return user when provided', () => {
      const user = { googleId: 'g123', email: 'test@example.com' };
      const result = guard.handleRequest(null, user, undefined);
      expect(result).toEqual(user);
    });

    it('should throw OAUTH_CANCELLED on access_denied', () => {
      expect(() => guard.handleRequest(null, null, { message: 'access_denied' })).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(null, null, { message: 'access_denied' })).toThrow(
        'OAUTH_CANCELLED',
      );
    });

    it('should throw OAUTH_PROVIDER_ERROR on other errors', () => {
      expect(() => guard.handleRequest(new Error('some error'), null, undefined)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(new Error('some error'), null, undefined)).toThrow(
        'OAUTH_PROVIDER_ERROR',
      );
    });

    it('should throw OAUTH_PROVIDER_ERROR when user is missing', () => {
      expect(() => guard.handleRequest(null, null, undefined)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, null, undefined)).toThrow('OAUTH_PROVIDER_ERROR');
    });
  });
});

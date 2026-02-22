import { Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createBaseOAuthGuard } from './base-oauth.guard';
import { OAUTH_PROVIDER, type OAuthProvider } from '../../domain/types';
import { OAuthErrorCode } from '../../auth.constants';

// Create a concrete test guard from the mixin
const TestBaseGuard = createBaseOAuthGuard('test-strategy');

class TestGuard extends TestBaseGuard {
  readonly logger = new Logger('TestGuard');

  getProvider(): OAuthProvider {
    return OAUTH_PROVIDER.GOOGLE;
  }

  buildAuthUrl(state: string): string {
    return `https://provider.example.com/auth?state=${state}`;
  }

  getCookiePath(): string {
    return '/api/auth';
  }

  isProviderEnabled(): boolean {
    return true;
  }
}

class DisabledTestGuard extends TestBaseGuard {
  readonly logger = new Logger('DisabledTestGuard');

  getProvider(): OAuthProvider {
    return OAUTH_PROVIDER.FACEBOOK;
  }

  buildAuthUrl(state: string): string {
    return `https://provider.example.com/auth?state=${state}`;
  }

  getCookiePath(): string {
    return '/api/auth';
  }

  isProviderEnabled(): boolean {
    return false;
  }
}

describe('BaseOAuthGuard', () => {
  const authCfg = {
    stateSecret: 'test-state-secret-that-is-at-least-32-bytes-long',
    isProduction: false,
  };

  let guard: TestGuard;

  beforeEach(() => {
    guard = new TestGuard(authCfg as any);
  });

  describe('state signing and verification', () => {
    it('should sign and verify a valid state payload', () => {
      const payload = guard.generateStatePayload('/dashboard');
      const signed = guard.signState(payload);

      const decoded = guard.verifyAndDecodeState(signed);

      expect(decoded).not.toBeNull();
      expect(decoded!.returnTo).toBe('/dashboard');
      expect(decoded!.provider).toBe('google');
      expect(decoded!.mode).toBe('login');
      expect(decoded!.nonce).toBeDefined();
      expect(decoded!.exp).toBeGreaterThan(Date.now());
    });

    it('should reject state with tampered data', () => {
      const payload = guard.generateStatePayload('/home');
      const signed = guard.signState(payload);
      const [data, sig] = signed.split('.');

      // Tamper with the data
      const tamperedData = data!.slice(0, -1) + (data!.endsWith('A') ? 'B' : 'A');
      const tampered = `${tamperedData}.${sig}`;

      expect(guard.verifyAndDecodeState(tampered)).toBeNull();
    });

    it('should reject state with tampered signature', () => {
      const payload = guard.generateStatePayload('/home');
      const signed = guard.signState(payload);
      const [data, sig] = signed.split('.');

      const tamperedSig = sig!.slice(0, -1) + (sig!.endsWith('A') ? 'B' : 'A');
      const tampered = `${data}.${tamperedSig}`;

      expect(guard.verifyAndDecodeState(tampered)).toBeNull();
    });

    it('should reject expired state', () => {
      const payload = guard.generateStatePayload('/home');
      // Set expiration in the past
      payload.exp = Date.now() - 1000;
      const signed = guard.signState(payload);

      expect(guard.verifyAndDecodeState(signed)).toBeNull();
    });

    it('should reject state with missing parts', () => {
      expect(guard.verifyAndDecodeState('')).toBeNull();
      expect(guard.verifyAndDecodeState('onlyonepart')).toBeNull();
      expect(guard.verifyAndDecodeState('too.many.parts')).toBeNull();
    });

    it('should reject state with invalid base64 data', () => {
      const sig = 'some-sig';
      expect(guard.verifyAndDecodeState(`!!!invalid!!!.${sig}`)).toBeNull();
    });
  });

  describe('generateStatePayload', () => {
    it('should include provider and login mode', () => {
      const payload = guard.generateStatePayload();

      expect(payload.provider).toBe('google');
      expect(payload.mode).toBe('login');
      expect(payload.nonce).toBeDefined();
      expect(payload.nonce.length).toBeGreaterThan(0);
      expect(payload.exp).toBeGreaterThan(Date.now());
    });

    it('should set returnTo to "/" when none provided', () => {
      const payload = guard.generateStatePayload();
      expect(payload.returnTo).toBe('/');
    });

    it('should set returnTo when valid path provided', () => {
      const payload = guard.generateStatePayload('/settings');
      expect(payload.returnTo).toBe('/settings');
    });

    it('should default returnTo to "/" for invalid paths', () => {
      const payload = guard.generateStatePayload('https://evil.com');
      expect(payload.returnTo).toBe('/');
    });
  });

  describe('buildSignedStateForLink', () => {
    it('should create state with link mode and userId', () => {
      const signed = guard.buildSignedStateForLink('user-123', '/settings');
      const decoded = guard.verifyAndDecodeState(signed);

      expect(decoded).not.toBeNull();
      expect(decoded!.mode).toBe('link');
      expect(decoded!.linkUserId).toBe('user-123');
      expect(decoded!.returnTo).toBe('/settings');
      expect(decoded!.provider).toBe('google');
    });

    it('should default returnTo to /settings', () => {
      const signed = guard.buildSignedStateForLink('user-123');
      const decoded = guard.verifyAndDecodeState(signed);

      expect(decoded!.returnTo).toBe('/settings');
    });
  });

  describe('safeCompare', () => {
    it('should return true for identical strings', () => {
      expect(guard.safeCompare('abc', 'abc')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(guard.safeCompare('abc', 'def')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(guard.safeCompare('abc', 'abcd')).toBe(false);
    });

    it('should return true for empty strings', () => {
      expect(guard.safeCompare('', '')).toBe(true);
    });
  });

  describe('validateReturnTo', () => {
    it('should accept valid relative paths', () => {
      expect(guard.validateReturnTo('/home')).toBe('/home');
      expect(guard.validateReturnTo('/users/123')).toBe('/users/123');
      expect(guard.validateReturnTo('/search?q=test')).toBe('/search?q=test');
    });

    it('should reject protocol-relative URLs', () => {
      expect(guard.validateReturnTo('//evil.com')).toBeNull();
    });

    it('should reject absolute URLs', () => {
      expect(guard.validateReturnTo('https://evil.com')).toBeNull();
      expect(guard.validateReturnTo('javascript:alert(1)')).toBeNull();
    });

    it('should return null for empty/undefined input', () => {
      expect(guard.validateReturnTo(undefined)).toBeNull();
      expect(guard.validateReturnTo('')).toBeNull();
    });
  });

  describe('getProviderDisplayName', () => {
    it('should capitalize the provider name', () => {
      expect(guard.getProviderDisplayName()).toBe('Google');
    });
  });

  describe('handleRequest', () => {
    it('should return user when valid', () => {
      const user = { id: 'u-1', email: 'test@example.com' };
      expect(guard.handleRequest(null, user, undefined)).toEqual(user);
    });

    it('should throw CANCELLED on access_denied', () => {
      expect(() => guard.handleRequest(null, null, { message: 'access_denied' })).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(null, null, { message: 'access_denied' })).toThrow(
        OAuthErrorCode.CANCELLED,
      );
    });

    it('should throw PROVIDER_ERROR when user is missing', () => {
      expect(() => guard.handleRequest(null, null, undefined)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, null, undefined)).toThrow(
        OAuthErrorCode.PROVIDER_ERROR,
      );
    });

    it('should throw PROVIDER_ERROR on error', () => {
      expect(() => guard.handleRequest(new Error('provider error'), null, undefined)).toThrow(
        OAuthErrorCode.PROVIDER_ERROR,
      );
    });
  });

  describe('canActivate', () => {
    const mockContext = (query: Record<string, string | undefined> = {}) => {
      const cookies: Record<string, string> = {};
      const req: any = { query, cookies, oauthStatePayload: undefined };
      const res: any = {
        redirect: jest.fn().mockResolvedValue(undefined),
        setCookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
      };
      return {
        context: {
          switchToHttp: () => ({
            getRequest: () => req,
            getResponse: () => res,
          }),
        } as any,
        req,
        res,
        cookies,
      };
    };

    it('should throw NotFoundException when provider is disabled', async () => {
      const disabledGuard = new DisabledTestGuard(authCfg as any);
      const { context } = mockContext();

      await expect(disabledGuard.canActivate(context)).rejects.toThrow(NotFoundException);
    });

    it('should redirect to provider on initiation (no code/error)', async () => {
      const { context, res } = mockContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://provider.example.com/auth?state='),
      );
      expect(res.setCookie).toHaveBeenCalledWith(
        'oauth_state',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/api/auth',
        }),
      );
    });

    it('should pass returnTo through state on initiation', async () => {
      const { context, res } = mockContext({ returnTo: '/dashboard' });

      await guard.canActivate(context);

      // The state cookie should encode the returnTo
      const stateArg = res.setCookie.mock.calls[0][1] as string;
      const decoded = guard.verifyAndDecodeState(stateArg);
      expect(decoded!.returnTo).toBe('/dashboard');
    });

    it('should throw CANCELLED on access_denied error', async () => {
      const { context } = mockContext({ error: 'access_denied' });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow(OAuthErrorCode.CANCELLED);
    });

    it('should throw STATE_INVALID when cookie is missing on callback', async () => {
      const { context } = mockContext({ code: 'auth-code', state: 'some-state' });

      await expect(guard.canActivate(context)).rejects.toThrow(OAuthErrorCode.STATE_INVALID);
    });

    it('should throw STATE_INVALID when cookie state mismatches query state', async () => {
      const payload = guard.generateStatePayload('/home');
      const signedState = guard.signState(payload);

      const { context, req } = mockContext({ code: 'auth-code', state: 'different-state' });
      req.cookies = { oauth_state: signedState };

      await expect(guard.canActivate(context)).rejects.toThrow(OAuthErrorCode.STATE_INVALID);
    });

    it('should validate state and clear cookie on valid callback', async () => {
      const payload = guard.generateStatePayload('/home');
      const signedState = guard.signState(payload);

      const { context, req, res } = mockContext({ code: 'auth-code', state: signedState });
      req.cookies = { oauth_state: signedState };

      // Passport's super.canActivate will be called — mock it
      // Since we can't easily mock AuthGuard's super, we test that the state
      // validation path runs without throwing STATE_INVALID
      try {
        await guard.canActivate(context);
      } catch {
        // super.canActivate may throw because no actual Passport strategy is registered
        // That's OK — we're testing state validation, not Passport integration
      }

      // State was decoded and stored on request
      expect(req.oauthStatePayload).toMatchObject({
        returnTo: '/home',
        provider: 'google',
        mode: 'login',
      });
      // Cookie was cleared
      expect(res.clearCookie).toHaveBeenCalledWith('oauth_state', { path: '/api/auth' });
    });
  });
});

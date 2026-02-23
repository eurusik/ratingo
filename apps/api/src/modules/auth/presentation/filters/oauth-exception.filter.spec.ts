import { HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import authConfig from '../../../../config/auth.config';
import { OAuthExceptionFilter } from './oauth-exception.filter';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const FRONTEND_URL = 'https://ratingo.com';

const mockAuthConfig = {
  frontendUrl: FRONTEND_URL,
};

/**
 * Creates a mock FastifyRequest for testing.
 */
function createMockRequest(
  overrides: Partial<{
    ip: string;
    url: string;
    headers: Record<string, string>;
    oauthStatePayload: { provider: string } | undefined;
  }> = {},
) {
  return {
    ip: overrides.ip ?? '127.0.0.1',
    url: overrides.url ?? '/api/auth/google/callback',
    headers: {
      'user-agent': 'test-agent',
      ...overrides.headers,
    },
    oauthStatePayload: overrides.oauthStatePayload,
  } as any;
}

/**
 * Creates a mock FastifyReply for testing redirect and JSON responses.
 */
function createMockReply() {
  const reply: any = {
    redirect: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  // Allow chaining: reply.status(401).send(body)
  reply.status.mockReturnValue(reply);
  return reply;
}

/**
 * Creates a mock ArgumentsHost that returns the given request and response.
 */
function createMockHost(request: any, response: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as any;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('OAuthExceptionFilter', () => {
  let filter: OAuthExceptionFilter;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OAuthExceptionFilter, { provide: authConfig.KEY, useValue: mockAuthConfig }],
    }).compile();

    filter = module.get(OAuthExceptionFilter);

    // Spy on logger.warn without emitting output
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // extractErrorCode (tested indirectly via catch behavior)
  // -----------------------------------------------------------------------

  describe('extractErrorCode', () => {
    it('should use string response as error code', () => {
      const exception = new UnauthorizedException('OAUTH_CANCELLED');
      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      // OAUTH_CANCELLED is a redirect code, so redirect should be called
      expect(reply.redirect).toHaveBeenCalledWith(expect.stringContaining('error=OAUTH_CANCELLED'));
    });

    it('should extract message from object response', () => {
      // Default UnauthorizedException creates { message: '...', statusCode: 401 }
      const exception = new UnauthorizedException({
        message: 'OAUTH_STATE_INVALID',
      });
      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=OAUTH_STATE_INVALID'),
      );
    });

    it('should fall back to UNKNOWN_ERROR for unrecognized response shape', () => {
      // Create an exception with a non-standard response (number)
      const exception = new UnauthorizedException();
      // Override getResponse to return something unexpected
      jest.spyOn(exception, 'getResponse').mockReturnValue(42 as any);

      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      // UNKNOWN_ERROR is not in REDIRECT_ERROR_CODES or JSON_ERROR_CODES,
      // so the exception should be re-thrown
      expect(() => filter.catch(exception, host)).toThrow(UnauthorizedException);
    });

    it('should fall back to UNKNOWN_ERROR for object with non-string message', () => {
      const exception = new UnauthorizedException();
      jest
        .spyOn(exception, 'getResponse')
        .mockReturnValue({ message: ['array', 'of', 'errors'] } as any);

      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      // UNKNOWN_ERROR is not an OAuth code, so it re-throws
      expect(() => filter.catch(exception, host)).toThrow(UnauthorizedException);
    });
  });

  // -----------------------------------------------------------------------
  // Redirect error codes
  // -----------------------------------------------------------------------

  describe('redirect error codes', () => {
    const REDIRECT_CODES = [
      'OAUTH_CANCELLED',
      'OAUTH_STATE_INVALID',
      'OAUTH_PROVIDER_ERROR',
      'OAUTH_EMAIL_NOT_VERIFIED',
    ];

    it.each(REDIRECT_CODES)('should redirect for error code %s', (code) => {
      const exception = new UnauthorizedException(code);
      const request = createMockRequest({
        oauthStatePayload: { provider: 'google' },
      });
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(reply.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/auth/callback/google?error=${encodeURIComponent(code)}`,
      );
    });

    it('should use correct redirect URL format', () => {
      const exception = new UnauthorizedException('OAUTH_CANCELLED');
      const request = createMockRequest({
        oauthStatePayload: { provider: 'facebook' },
      });
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(reply.redirect).toHaveBeenCalledWith(
        'https://ratingo.com/auth/callback/facebook?error=OAUTH_CANCELLED',
      );
    });

    describe('provider resolution', () => {
      it('should prefer provider from oauthStatePayload', () => {
        const exception = new UnauthorizedException('OAUTH_CANCELLED');
        const request = createMockRequest({
          url: '/api/auth/google/callback',
          oauthStatePayload: { provider: 'facebook' },
        });
        const reply = createMockReply();
        const host = createMockHost(request, reply);

        filter.catch(exception, host);

        expect(reply.redirect).toHaveBeenCalledWith(
          expect.stringContaining('/auth/callback/facebook?'),
        );
      });

      it('should infer provider from URL when oauthStatePayload is missing', () => {
        const exception = new UnauthorizedException('OAUTH_CANCELLED');
        const request = createMockRequest({
          url: '/api/auth/facebook/callback',
          oauthStatePayload: undefined,
        });
        const reply = createMockReply();
        const host = createMockHost(request, reply);

        filter.catch(exception, host);

        expect(reply.redirect).toHaveBeenCalledWith(
          expect.stringContaining('/auth/callback/facebook?'),
        );
      });

      it('should fall back to google when provider cannot be determined', () => {
        const exception = new UnauthorizedException('OAUTH_CANCELLED');
        const request = createMockRequest({
          url: '/api/other/path',
          oauthStatePayload: undefined,
        });
        const reply = createMockReply();
        const host = createMockHost(request, reply);

        filter.catch(exception, host);

        expect(reply.redirect).toHaveBeenCalledWith(
          expect.stringContaining('/auth/callback/google?'),
        );
      });

      it('should fall back to google when URL has unsupported provider', () => {
        const exception = new UnauthorizedException('OAUTH_PROVIDER_ERROR');
        const request = createMockRequest({
          url: '/api/auth/github/callback',
          oauthStatePayload: undefined,
        });
        const reply = createMockReply();
        const host = createMockHost(request, reply);

        filter.catch(exception, host);

        expect(reply.redirect).toHaveBeenCalledWith(
          expect.stringContaining('/auth/callback/google?'),
        );
      });
    });
  });

  // -----------------------------------------------------------------------
  // JSON error codes
  // -----------------------------------------------------------------------

  describe('JSON error codes', () => {
    it('should return 401 JSON for OAUTH_EXCHANGE_EXPIRED', () => {
      const exception = new UnauthorizedException('OAUTH_EXCHANGE_EXPIRED');
      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'OAUTH_EXCHANGE_EXPIRED',
          message: 'Session expired, please try again',
          statusCode: HttpStatus.UNAUTHORIZED,
        },
      });
    });

    it('should return 401 JSON for OAUTH_EXCHANGE_USED', () => {
      const exception = new UnauthorizedException('OAUTH_EXCHANGE_USED');
      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'OAUTH_EXCHANGE_USED',
          message: 'Session already used, please try again',
          statusCode: HttpStatus.UNAUTHORIZED,
        },
      });
    });

    it('should not call redirect for JSON error codes', () => {
      const exception = new UnauthorizedException('OAUTH_EXCHANGE_EXPIRED');
      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(reply.redirect).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Non-OAuth errors (re-thrown)
  // -----------------------------------------------------------------------

  describe('non-OAuth errors', () => {
    it('should re-throw UnauthorizedException with unrecognized message', () => {
      const exception = new UnauthorizedException('Invalid credentials');
      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      expect(() => filter.catch(exception, host)).toThrow(UnauthorizedException);
      expect(reply.redirect).not.toHaveBeenCalled();
      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should re-throw the exact same exception instance', () => {
      const exception = new UnauthorizedException('Something else');
      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      try {
        filter.catch(exception, host);
        fail('Expected exception to be thrown');
      } catch (error) {
        expect(error).toBe(exception);
      }
    });

    it('should re-throw for default UnauthorizedException (no custom message)', () => {
      // Default UnauthorizedException has message "Unauthorized"
      const exception = new UnauthorizedException();
      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      expect(() => filter.catch(exception, host)).toThrow(UnauthorizedException);
    });
  });

  // -----------------------------------------------------------------------
  // inferProviderFromUrl (tested indirectly via redirect provider resolution)
  // -----------------------------------------------------------------------

  describe('inferProviderFromUrl', () => {
    // We test this through catch() behavior by observing which provider
    // ends up in the redirect URL when oauthStatePayload is absent.

    it('should extract google from /api/auth/google/callback', () => {
      const exception = new UnauthorizedException('OAUTH_CANCELLED');
      const request = createMockRequest({
        url: '/api/auth/google/callback',
        oauthStatePayload: undefined,
      });
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/auth/callback/google?'),
      );
    });

    it('should extract facebook from /api/auth/facebook', () => {
      const exception = new UnauthorizedException('OAUTH_CANCELLED');
      const request = createMockRequest({
        url: '/api/auth/facebook',
        oauthStatePayload: undefined,
      });
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/auth/callback/facebook?'),
      );
    });

    it('should return null for unknown provider /api/auth/unknown', () => {
      const exception = new UnauthorizedException('OAUTH_CANCELLED');
      const request = createMockRequest({
        url: '/api/auth/unknown',
        oauthStatePayload: undefined,
      });
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      // Falls back to 'google'
      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/auth/callback/google?'),
      );
    });

    it('should return null for non-auth paths /api/other/path', () => {
      const exception = new UnauthorizedException('OAUTH_CANCELLED');
      const request = createMockRequest({
        url: '/api/other/path',
        oauthStatePayload: undefined,
      });
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      // Falls back to 'google'
      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/auth/callback/google?'),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Logging
  // -----------------------------------------------------------------------

  describe('logging', () => {
    it('should log warning with error code and request context for redirect errors', () => {
      const exception = new UnauthorizedException('OAUTH_CANCELLED');
      const request = createMockRequest({
        ip: '192.168.1.100',
        url: '/api/auth/google/callback',
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(loggerWarnSpy).toHaveBeenCalledWith('OAuth error: OAUTH_CANCELLED', {
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        path: '/api/auth/google/callback',
      });
    });

    it('should log warning with error code for JSON errors', () => {
      const exception = new UnauthorizedException('OAUTH_EXCHANGE_EXPIRED');
      const request = createMockRequest({
        ip: '10.0.0.1',
        url: '/api/auth/exchange',
        headers: { 'user-agent': 'PostmanRuntime/7.0' },
      });
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(loggerWarnSpy).toHaveBeenCalledWith('OAuth error: OAUTH_EXCHANGE_EXPIRED', {
        ip: '10.0.0.1',
        userAgent: 'PostmanRuntime/7.0',
        path: '/api/auth/exchange',
      });
    });

    it('should log warning even for non-OAuth errors before re-throwing', () => {
      const exception = new UnauthorizedException('Invalid credentials');
      const request = createMockRequest();
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      expect(() => filter.catch(exception, host)).toThrow();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'OAuth error: Invalid credentials',
        expect.objectContaining({
          ip: '127.0.0.1',
        }),
      );
    });

    it('should handle missing user-agent header gracefully', () => {
      const exception = new UnauthorizedException('OAUTH_CANCELLED');
      const request = {
        ip: '127.0.0.1',
        url: '/api/auth/google/callback',
        headers: {},
        oauthStatePayload: { provider: 'google' },
      } as any;
      const reply = createMockReply();
      const host = createMockHost(request, reply);

      filter.catch(exception, host);

      expect(loggerWarnSpy).toHaveBeenCalledWith('OAuth error: OAUTH_CANCELLED', {
        ip: '127.0.0.1',
        userAgent: undefined,
        path: '/api/auth/google/callback',
      });
    });
  });
});

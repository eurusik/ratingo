import { Logger } from '@nestjs/common';

import { OAuthReturnOriginResolver } from './oauth-return-origin.resolver';

const FRONTEND_URL = 'https://ratingo.top';

const createResolver = () =>
  new OAuthReturnOriginResolver({
    frontendUrl: FRONTEND_URL,
    oauthReturnOrigins: [
      'https://dev.ratingo.top',
      /^https:\/\/ratingo-admin-[a-z0-9]{9}-eurusik\.vercel\.app$/,
    ],
  } as never);

describe('OAuthReturnOriginResolver', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  describe('resolve', () => {
    it('falls back to frontendUrl without logging when no origin is requested', () => {
      expect(createResolver().resolve(undefined)).toBe(FRONTEND_URL);
      expect(createResolver().resolve('')).toBe(FRONTEND_URL);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      'https://dev.ratingo.top',
      'https://ratingo-admin-abc123xyz-eurusik.vercel.app',
      FRONTEND_URL,
    ])('returns allowed origin %p', (origin) => {
      expect(createResolver().resolve(origin)).toBe(origin);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      ['https://evil.test', 'NOT_ALLOWED'],
      ['https://dev.ratingo.top/settings', 'NOT_A_BARE_ORIGIN'],
      ['not a url', 'MALFORMED_URL'],
    ])('falls back to frontendUrl and logs the reason for %p', (origin, reason) => {
      expect(createResolver().resolve(origin)).toBe(FRONTEND_URL);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`reason=${reason}`));
    });
  });

  it('accepts the frontend origin when frontendUrl ends with a slash', () => {
    const resolver = new OAuthReturnOriginResolver({
      frontendUrl: `${FRONTEND_URL}/`,
      oauthReturnOrigins: [],
    } as never);

    expect(resolver.resolve(FRONTEND_URL)).toBe(FRONTEND_URL);
    expect(warn).not.toHaveBeenCalled();
  });

  describe('redirectBase', () => {
    it('uses the return origin carried in the verified state', () => {
      expect(
        createResolver().redirectBase({
          nonce: 'n',
          returnTo: '/',
          exp: 0,
          returnOrigin: 'https://dev.ratingo.top',
        }),
      ).toBe('https://dev.ratingo.top');
    });

    it('falls back to frontendUrl when the state has no return origin', () => {
      expect(createResolver().redirectBase(undefined)).toBe(FRONTEND_URL);
      expect(createResolver().redirectBase({ nonce: 'n', returnTo: '/', exp: 0 })).toBe(
        FRONTEND_URL,
      );
    });
  });
});

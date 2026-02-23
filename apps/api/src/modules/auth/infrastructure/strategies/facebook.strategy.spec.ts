import { UnauthorizedException } from '@nestjs/common';
import { type Profile as FacebookProfile } from 'passport-facebook';

import { OAuthErrorCode } from '../../auth.constants';
import { OAUTH_PROVIDER } from '../../domain/types';

import { FacebookStrategy } from './facebook.strategy';

/**
 * Build a mock Facebook profile.
 * Facebook profiles use `emails`, `photos`, and `displayName` fields.
 */
function buildFacebookProfile(overrides: Partial<FacebookProfile> = {}): FacebookProfile {
  return {
    id: 'fb-123456',
    displayName: 'Test User',
    emails: [{ value: 'test@example.com' }],
    photos: [{ value: 'https://graph.facebook.com/fb-123456/picture' }],
    provider: 'facebook',
    profileUrl: '',
    _raw: '',
    _json: {},
    ...overrides,
  } as FacebookProfile;
}

describe('FacebookStrategy', () => {
  let strategy: FacebookStrategy;

  const facebookConfig = {
    appId: 'test-app-id',
    appSecret: 'test-app-secret',
    callbackUrl: 'http://localhost:3000/api/auth/facebook/callback',
    enabled: true,
  };

  beforeEach(() => {
    /**
     * PassportStrategy constructor calls super() which invokes
     * passport-facebook's Strategy constructor. We bypass that
     * by only testing the validate() method directly.
     */
    strategy = Object.create(FacebookStrategy.prototype);
    (strategy as any).config = facebookConfig;
  });

  describe('validate', () => {
    it('should return correct OAuthUserPayload with provider="facebook"', async () => {
      const profile = buildFacebookProfile();

      const result = await strategy.validate('access-token', 'refresh-token', profile);

      expect(result).toEqual({
        provider: OAUTH_PROVIDER.FACEBOOK,
        providerAccountId: 'fb-123456',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://graph.facebook.com/fb-123456/picture',
      });
    });

    it('should throw UnauthorizedException when email is missing (no emails array)', async () => {
      const profile = buildFacebookProfile({ emails: undefined });

      await expect(strategy.validate('access-token', 'refresh-token', profile)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate('access-token', 'refresh-token', profile)).rejects.toThrow(
        OAuthErrorCode.EMAIL_NOT_VERIFIED,
      );
    });

    it('should throw UnauthorizedException when emails array is empty', async () => {
      const profile = buildFacebookProfile({ emails: [] });

      await expect(strategy.validate('access-token', 'refresh-token', profile)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate('access-token', 'refresh-token', profile)).rejects.toThrow(
        OAuthErrorCode.EMAIL_NOT_VERIFIED,
      );
    });

    it('should extract displayName correctly', async () => {
      const profile = buildFacebookProfile({ displayName: 'Jane Doe' });

      const result = await strategy.validate('access-token', 'refresh-token', profile);

      expect(result.name).toBe('Jane Doe');
    });

    it('should fallback to empty string when displayName is missing', async () => {
      const profile = buildFacebookProfile({ displayName: '' });

      const result = await strategy.validate('access-token', 'refresh-token', profile);

      expect(result.name).toBe('');
    });

    it('should extract photo URL from photos array', async () => {
      const profile = buildFacebookProfile({
        photos: [{ value: 'https://example.com/photo.jpg' }],
      });

      const result = await strategy.validate('access-token', 'refresh-token', profile);

      expect(result.picture).toBe('https://example.com/photo.jpg');
    });

    it('should return null picture when photos array is missing', async () => {
      const profile = buildFacebookProfile({ photos: undefined });

      const result = await strategy.validate('access-token', 'refresh-token', profile);

      expect(result.picture).toBeNull();
    });

    it('should return null picture when photos array is empty', async () => {
      const profile = buildFacebookProfile({ photos: [] });

      const result = await strategy.validate('access-token', 'refresh-token', profile);

      expect(result.picture).toBeNull();
    });

    it('should use the first email when multiple emails are present', async () => {
      const profile = buildFacebookProfile({
        emails: [{ value: 'primary@example.com' }, { value: 'secondary@example.com' }],
      });

      const result = await strategy.validate('access-token', 'refresh-token', profile);

      expect(result.email).toBe('primary@example.com');
    });

    it('should use the first photo when multiple photos are present', async () => {
      const profile = buildFacebookProfile({
        photos: [
          { value: 'https://example.com/photo1.jpg' },
          { value: 'https://example.com/photo2.jpg' },
        ],
      });

      const result = await strategy.validate('access-token', 'refresh-token', profile);

      expect(result.picture).toBe('https://example.com/photo1.jpg');
    });

    it('should use profile.id as providerAccountId', async () => {
      const profile = buildFacebookProfile({ id: 'fb-unique-999' });

      const result = await strategy.validate('access-token', 'refresh-token', profile);

      expect(result.providerAccountId).toBe('fb-unique-999');
    });
  });
});

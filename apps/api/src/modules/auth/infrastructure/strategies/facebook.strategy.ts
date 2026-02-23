import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { Strategy, type Profile as FacebookProfile } from 'passport-facebook';

import facebookConfig from '../../../../config/facebook.config';
import { OAuthErrorCode } from '../../auth.constants';
import { OAUTH_PROVIDER, type OAuthUserPayload } from '../../domain/types';

/**
 * Passport strategy for Facebook OAuth 2.0 authorization code flow.
 *
 * State management is handled externally by FacebookAuthGuard via signed httpOnly cookie.
 * This strategy only validates the Facebook profile and extracts user data.
 */
@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    @Inject(facebookConfig.KEY)
    private readonly config: ConfigType<typeof facebookConfig>,
  ) {
    super({
      clientID: config.appId,
      clientSecret: config.appSecret,
      callbackURL: config.callbackUrl,
      profileFields: ['id', 'displayName', 'emails', 'photos'],
      scope: ['email'],
      graphAPIVersion: 'v24.0',
      // State is managed manually via signed httpOnly cookie in FacebookAuthGuard
      state: false,
    });
  }

  /**
   * Validates Facebook profile and extracts user payload.
   *
   * @throws {UnauthorizedException} OAUTH_EMAIL_NOT_VERIFIED when email is missing
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: FacebookProfile,
  ): Promise<OAuthUserPayload> {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      throw new UnauthorizedException(OAuthErrorCode.EMAIL_NOT_VERIFIED);
    }

    return {
      provider: OAUTH_PROVIDER.FACEBOOK,
      providerAccountId: profile.id,
      email,
      name: profile.displayName || '',
      picture: profile.photos?.[0]?.value || null,
    };
  }
}

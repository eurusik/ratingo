import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { Strategy, type Profile as GoogleProfile } from 'passport-google-oauth20';

import googleConfig from '../../../../config/google.config';
import { OAuthErrorCode } from '../../auth.constants';
import { OAUTH_PROVIDER, type OAuthUserPayload } from '../../domain/types';

/**
 * Passport strategy for Google OAuth 2.0 authorization code flow.
 *
 * State management is handled externally by GoogleAuthGuard via signed httpOnly cookie.
 * This strategy only validates the Google profile and extracts user data.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleConfig.KEY)
    private readonly config: ConfigType<typeof googleConfig>,
  ) {
    super({
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      callbackURL: config.callbackUrl,
      scope: ['email', 'profile', 'openid'],
      // State is managed manually via signed httpOnly cookie in GoogleAuthGuard
      // GoogleAuthGuard passes state via getAuthenticateOptions()
      state: false,
    });
  }

  /**
   * Validates Google profile and extracts user payload.
   *
   * @throws {UnauthorizedException} OAUTH_EMAIL_NOT_VERIFIED when email is missing or not verified
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
  ): Promise<OAuthUserPayload> {
    const email = profile.emails?.[0]?.value;
    // email_verified is more reliably found in _json than in emails array
    const emailVerified = (profile._json as { email_verified?: boolean })?.email_verified === true;

    if (!email) {
      throw new UnauthorizedException(OAuthErrorCode.EMAIL_NOT_VERIFIED);
    }

    if (!emailVerified) {
      throw new UnauthorizedException(OAuthErrorCode.EMAIL_NOT_VERIFIED);
    }

    return {
      provider: OAUTH_PROVIDER.GOOGLE,
      providerAccountId: profile.id,
      email,
      name: profile.displayName || '',
      picture: profile.photos?.[0]?.value ?? null,
    };
  }
}

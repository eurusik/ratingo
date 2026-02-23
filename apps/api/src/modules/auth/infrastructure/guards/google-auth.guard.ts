import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import authConfig from '../../../../config/auth.config';
import googleConfig from '../../../../config/google.config';
import {
  GOOGLE_AUTH_COOKIE_PATH,
  GOOGLE_AUTH_URL,
  GOOGLE_OAUTH_SCOPES,
  GoogleOAuthParams,
} from '../../auth.constants';
import { OAUTH_PROVIDER, type OAuthProvider } from '../../domain/types';

import { createBaseOAuthGuard } from './base-oauth.guard';

/**
 * Guard for Google OAuth with CSRF protection via signed state cookie.
 * Extends the shared BaseOAuthGuard with Google-specific URL building.
 */
@Injectable()
export class GoogleAuthGuard extends createBaseOAuthGuard('google') {
  readonly logger = new Logger(GoogleAuthGuard.name);

  constructor(
    @Inject(googleConfig.KEY)
    private readonly config: ConfigType<typeof googleConfig>,
    @Inject(authConfig.KEY)
    authCfg: ConfigType<typeof authConfig>,
  ) {
    super(authCfg);
  }

  getProvider(): OAuthProvider {
    return OAUTH_PROVIDER.GOOGLE;
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      response_type: GoogleOAuthParams.RESPONSE_TYPE,
      scope: GOOGLE_OAUTH_SCOPES,
      state,
      access_type: GoogleOAuthParams.ACCESS_TYPE,
      prompt: GoogleOAuthParams.PROMPT,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  getCookiePath(): string {
    return GOOGLE_AUTH_COOKIE_PATH;
  }

  isProviderEnabled(): boolean {
    return this.config.enabled;
  }
}

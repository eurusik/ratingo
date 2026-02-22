import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import authConfig from '../../../../config/auth.config';
import facebookConfig from '../../../../config/facebook.config';
import {
  FACEBOOK_AUTH_COOKIE_PATH,
  FACEBOOK_AUTH_URL,
  FACEBOOK_OAUTH_SCOPES,
  FacebookOAuthParams,
} from '../../auth.constants';
import { OAUTH_PROVIDER, type OAuthProvider } from '../../domain/types';

import { createBaseOAuthGuard } from './base-oauth.guard';

/**
 * Guard for Facebook OAuth with CSRF protection via signed state cookie.
 * Extends the shared BaseOAuthGuard with Facebook-specific URL building.
 */
@Injectable()
export class FacebookAuthGuard extends createBaseOAuthGuard('facebook') {
  readonly logger = new Logger(FacebookAuthGuard.name);

  constructor(
    @Inject(facebookConfig.KEY)
    private readonly config: ConfigType<typeof facebookConfig>,
    @Inject(authConfig.KEY)
    authCfg: ConfigType<typeof authConfig>,
  ) {
    super(authCfg);
  }

  getProvider(): OAuthProvider {
    return OAUTH_PROVIDER.FACEBOOK;
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: this.config.callbackUrl,
      scope: FACEBOOK_OAUTH_SCOPES,
      state,
      response_type: FacebookOAuthParams.RESPONSE_TYPE,
      display: FacebookOAuthParams.DISPLAY,
    });

    return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
  }

  getCookiePath(): string {
    return FACEBOOK_AUTH_COOKIE_PATH;
  }

  isProviderEnabled(): boolean {
    return this.config.enabled;
  }
}

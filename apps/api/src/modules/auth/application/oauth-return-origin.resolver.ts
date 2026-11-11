import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import authConfig from '@/config/auth.config';
import { evaluateReturnOrigin } from '@/modules/auth/domain/policies/oauth-return-origin.policy';
import { type OAuthStatePayload } from '@/modules/auth/domain/types';

const MAX_LOGGED_ORIGIN_LENGTH = 200;
const TRAILING_SLASHES = /\/+$/;

@Injectable()
export class OAuthReturnOriginResolver {
  private readonly logger = new Logger(OAuthReturnOriginResolver.name);

  constructor(
    @Inject(authConfig.KEY)
    private readonly authCfg: ConfigType<typeof authConfig>,
  ) {}

  resolve(requestedOrigin: string | undefined): string {
    const { frontendUrl, oauthReturnOrigins } = this.authCfg;
    if (!requestedOrigin) return frontendUrl;

    const frontendOrigin = frontendUrl.replace(TRAILING_SLASHES, '');
    const decision = evaluateReturnOrigin(requestedOrigin, [frontendOrigin, ...oauthReturnOrigins]);
    if (decision.allowed) return decision.origin;

    this.logger.warn(
      `OAuth return origin rejected (reason=${decision.reason}, origin=${JSON.stringify(
        requestedOrigin.slice(0, MAX_LOGGED_ORIGIN_LENGTH),
      )}); falling back to frontendUrl`,
    );
    return frontendUrl;
  }

  redirectBase(statePayload: OAuthStatePayload | undefined): string {
    return statePayload?.returnOrigin ?? this.authCfg.frontendUrl;
  }
}

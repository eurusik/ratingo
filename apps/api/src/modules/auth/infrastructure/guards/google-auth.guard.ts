import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

import {
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { AuthGuard, type IAuthModuleOptions } from '@nestjs/passport';

import { type FastifyReply, type FastifyRequest } from 'fastify';

import authConfig from '../../../../config/auth.config';
import googleConfig from '../../../../config/google.config';
import {
  GOOGLE_AUTH_COOKIE_PATH,
  GOOGLE_AUTH_URL,
  GOOGLE_OAUTH_SCOPES,
  GoogleOAuthError,
  GoogleOAuthParams,
  OAUTH_NONCE_SIZE_BYTES,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_MS,
  OAuthErrorCode,
  RETURN_TO_PATTERN,
} from '../../auth.constants';
import { type OAuthStatePayload } from '../types/oauth.types';
// Import for module augmentation side effects
import '../types/oauth.types';

/** Milliseconds per second (for cookie maxAge conversion) */
const MS_PER_SECOND = 1000;

/**
 * Guard for Google OAuth with CSRF protection via signed state cookie.
 *
 * Handles two phases:
 * 1. Initiation: generates signed state, sets httpOnly cookie, redirects to Google
 * 2. Callback: validates state from cookie vs query param, delegates to Passport
 *
 * Manually handles initiation redirect to avoid Passport's Express-specific methods.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleAuthGuard.name);

  constructor(
    @Inject(googleConfig.KEY)
    private readonly config: ConfigType<typeof googleConfig>,
    @Inject(authConfig.KEY)
    private readonly authCfg: ConfigType<typeof authConfig>,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.logger.debug('canActivate called');

    if (!this.config.enabled) {
      throw new NotFoundException('Google OAuth is not configured');
    }

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const res = context.switchToHttp().getResponse<FastifyReply>();
    const query = req.query as Record<string, string | undefined>;

    this.logger.debug(
      `Query params: code=${!!query.code}, error=${query.error}, state=${!!query.state}`,
    );

    // On initiation: manually redirect to Google (bypass Passport's Express-specific redirect)
    if (!query.code && !query.error) {
      this.logger.debug('Initiation phase - redirecting to Google');
      const statePayload = this.generateStatePayload(query.returnTo);
      const signedState = this.signState(statePayload);
      this.setStateCookie(res, signedState);

      // Build Google OAuth URL manually
      const authUrl = this.buildGoogleAuthUrl(signedState);
      await res.redirect(authUrl);
      return false; // Request handled, don't continue to controller
    }

    // Handle user cancellation (access_denied)
    if (query.error === GoogleOAuthError.ACCESS_DENIED) {
      this.logger.debug('User cancelled OAuth');
      throw new UnauthorizedException(OAuthErrorCode.CANCELLED);
    }

    // On callback: validate state from cookie vs query
    if (query.code && query.state) {
      this.logger.debug('Callback phase - validating state');
      const cookieState = this.getStateCookie(req);
      this.logger.debug(`Cookie state present: ${!!cookieState}`);

      if (!cookieState || !this.safeCompare(cookieState, query.state)) {
        this.logger.warn('State mismatch or missing cookie');
        throw new UnauthorizedException(OAuthErrorCode.STATE_INVALID);
      }
      // Verify signature and expiration
      const payload = this.verifyAndDecodeState(cookieState);
      if (!payload) {
        this.logger.warn('State verification failed');
        throw new UnauthorizedException(OAuthErrorCode.STATE_INVALID);
      }
      // Store decoded payload for controller to access returnTo
      req.oauthStatePayload = payload;
      this.clearStateCookie(res);
      this.logger.debug('State validated, calling Passport');
    }

    // Let Passport handle the callback (token exchange)
    this.logger.debug('Calling super.canActivate (Passport)');
    const result = await super.canActivate(context);
    this.logger.debug(`Passport returned: ${result}`);
    return result as boolean;
  }

  private buildGoogleAuthUrl(state: string): string {
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

  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    // On initiation, pass the signed state to be included in Google redirect URL
    if (req.oauthState) {
      return { state: req.oauthState };
    }
    return {};
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: { message?: string } | undefined,
  ): TUser {
    if (err || !user) {
      if (info?.message === 'access_denied') {
        throw new UnauthorizedException(OAuthErrorCode.CANCELLED);
      }
      throw new UnauthorizedException(OAuthErrorCode.PROVIDER_ERROR);
    }
    return user;
  }

  private generateStatePayload(returnTo?: string): OAuthStatePayload {
    return {
      nonce: randomBytes(OAUTH_NONCE_SIZE_BYTES).toString('hex'),
      returnTo: this.validateReturnTo(returnTo) || '/',
      exp: Date.now() + OAUTH_STATE_TTL_MS,
    };
  }

  private signState(payload: OAuthStatePayload): string {
    const json = JSON.stringify(payload);
    const data = Buffer.from(json).toString('base64url');
    const sig = createHmac('sha256', this.authCfg.stateSecret).update(data).digest('base64url');
    return `${data}.${sig}`;
  }

  private verifyAndDecodeState(signedState: string): OAuthStatePayload | null {
    const parts = signedState.split('.');
    if (parts.length !== 2) return null;

    const [data, sig] = parts;
    if (!data || !sig) return null;

    const expectedSig = createHmac('sha256', this.authCfg.stateSecret)
      .update(data)
      .digest('base64url');

    if (!this.safeCompare(sig, expectedSig)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as OAuthStatePayload;
      if (payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // Length check before timingSafeEqual to prevent exception
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private setStateCookie(res: FastifyReply, state: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    // @fastify/cookie adds setCookie method at runtime
    (res as any).setCookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: OAUTH_STATE_TTL_MS / MS_PER_SECOND,
      path: GOOGLE_AUTH_COOKIE_PATH,
    });
  }

  private getStateCookie(req: FastifyRequest): string | undefined {
    // @fastify/cookie adds cookies property at runtime
    return (req as any).cookies?.[OAUTH_STATE_COOKIE];
  }

  private clearStateCookie(res: FastifyReply): void {
    // @fastify/cookie adds clearCookie method at runtime
    (res as any).clearCookie(OAUTH_STATE_COOKIE, { path: GOOGLE_AUTH_COOKIE_PATH });
  }

  private validateReturnTo(returnTo?: string): string | null {
    if (!returnTo) return null;
    // Only allow relative paths: starts with /, no //, matches safe pattern
    if (!RETURN_TO_PATTERN.test(returnTo) || returnTo.startsWith('//')) {
      return null;
    }
    return returnTo;
  }
}

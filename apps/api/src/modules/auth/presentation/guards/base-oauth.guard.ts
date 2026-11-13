import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

import {
  type ExecutionContext,
  type Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { AuthGuard, type IAuthModuleOptions } from '@nestjs/passport';

import { type FastifyReply, type FastifyRequest } from 'fastify';
import { isObservable, lastValueFrom } from 'rxjs';

import { MS_PER_SECOND } from '@/common/constants';
import type authConfig from '@/config/auth.config';
import { type OAuthReturnOriginResolver } from '@/modules/auth/application/oauth-return-origin.resolver';
import {
  OAUTH_NONCE_SIZE_BYTES,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_MS,
  OAuthErrorCode,
  RETURN_TO_PATTERN,
} from '@/modules/auth/auth.constants';
import { type OAuthProvider, type OAuthStatePayload } from '@/modules/auth/domain/types';
// Import for module augmentation side effects (Fastify request extension)
import '../types/oauth.types';

/**
 * Cookie options for setCookie method.
 */
interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  maxAge?: number;
  path?: string;
}

/**
 * Type for Fastify reply with cookie methods (added by @fastify/cookie plugin).
 */
type ReplyWithCookies = FastifyReply & {
  setCookie(name: string, value: string, options?: CookieOptions): FastifyReply;
  clearCookie(name: string, options?: { path?: string }): FastifyReply;
};

/**
 * Creates an abstract base OAuth guard class parameterized by Passport strategy name.
 *
 * Handles CSRF protection via signed state cookie, redirect orchestration,
 * and Passport delegation. Subclasses provide provider-specific URL building.
 *
 * **Note:** All members are public (not protected) due to TypeScript limitation TS4094 —
 * inferred return types of functions cannot reference privately-named members in anonymous classes.
 * Methods like signState/verifyAndDecodeState should be treated as internal by consumers.
 *
 * @param strategyName - Passport strategy name (e.g., 'google', 'facebook')
 * @returns Abstract guard class to extend
 *
 * @example
 * class GoogleAuthGuard extends createBaseOAuthGuard('google') {
 *   getProvider() { return OAUTH_PROVIDER.GOOGLE; }
 *   buildAuthUrl(state: string) { return `https://accounts.google.com/...?state=${state}`; }
 *   getCookiePath() { return '/api/auth'; }
 *   isProviderEnabled() { return this.config.enabled; }
 * }
 */
export function createBaseOAuthGuard(strategyName: string) {
  abstract class BaseOAuthGuard extends AuthGuard(strategyName) {
    abstract readonly logger: Logger;

    constructor(
      readonly authCfg: ConfigType<typeof authConfig>,
      readonly returnOrigins: OAuthReturnOriginResolver,
    ) {
      super();
    }

    /** OAuth provider identifier for state/redirect routing. */
    abstract getProvider(): OAuthProvider;

    /** Build the provider's OAuth authorization URL with signed state. */
    abstract buildAuthUrl(state: string): string;

    /** Cookie path scope for this provider's OAuth flow. */
    abstract getCookiePath(): string;

    /** Whether this provider is enabled (env vars present). */
    abstract isProviderEnabled(): boolean;

    /** Human-readable provider name for error messages. */
    getProviderDisplayName(): string {
      return this.getProvider().charAt(0).toUpperCase() + this.getProvider().slice(1);
    }

    override async canActivate(context: ExecutionContext): Promise<boolean> {
      this.logger.debug('canActivate called');

      if (!this.isProviderEnabled()) {
        throw new NotFoundException(`${this.getProviderDisplayName()} OAuth is not configured`);
      }

      const req = context.switchToHttp().getRequest<FastifyRequest>();
      const res = context.switchToHttp().getResponse<FastifyReply>();
      const query = req.query as Record<string, string | undefined>;

      this.logger.debug(
        `Query params: code=${!!query.code}, error=${query.error}, state=${!!query.state}`,
      );

      // On initiation: manually redirect to provider (bypass Passport's Express-specific redirect)
      if (!query.code && !query.error) {
        this.logger.debug('Initiation phase - redirecting to provider');
        const statePayload = this.generateStatePayload(query.returnTo, query.returnOrigin);
        const signedState = this.signState(statePayload);
        this.setStateCookie(res, signedState);

        const authUrl = this.buildAuthUrl(signedState);
        await res.redirect(authUrl);
        return false; // Request handled, don't continue to controller
      }

      const callbackCarriesState = Boolean(query.code || query.state);
      const stateAttached = callbackCarriesState && this.attachVerifiedState(req, res, query.state);

      if (query.error === 'access_denied') {
        this.logger.debug('User cancelled OAuth');
        throw new UnauthorizedException(OAuthErrorCode.CANCELLED);
      }

      if (query.code && !stateAttached) {
        throw new UnauthorizedException(OAuthErrorCode.STATE_INVALID);
      }

      // Let Passport handle the callback (token exchange)
      this.logger.debug('Calling super.canActivate (Passport)');
      const result = await super.canActivate(context);
      const allowed = isObservable(result) ? await lastValueFrom(result) : result;
      this.logger.debug(`Passport returned: ${allowed}`);
      return allowed;
    }

    override getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
      const req = context.switchToHttp().getRequest<FastifyRequest>();
      if (req.oauthState) {
        return { state: req.oauthState };
      }
      return {};
    }

    override handleRequest<TUser>(
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

    /**
     * Builds a signed state for link mode (connecting a provider to an existing account).
     */
    buildSignedStateForLink(userId: string, returnTo?: string, returnOrigin?: string): string {
      const payload: OAuthStatePayload = {
        nonce: randomBytes(OAUTH_NONCE_SIZE_BYTES).toString('hex'),
        returnTo: this.validateReturnTo(returnTo) || '/settings',
        exp: Date.now() + OAUTH_STATE_TTL_MS,
        provider: this.getProvider(),
        mode: 'link',
        linkUserId: userId,
        returnOrigin: this.returnOrigins.resolve(returnOrigin),
      };
      return this.signState(payload);
    }

    // --- State management (shared across all providers) ---

    generateStatePayload(returnTo?: string, returnOrigin?: string): OAuthStatePayload {
      return {
        nonce: randomBytes(OAUTH_NONCE_SIZE_BYTES).toString('hex'),
        returnTo: this.validateReturnTo(returnTo) || '/',
        exp: Date.now() + OAUTH_STATE_TTL_MS,
        provider: this.getProvider(),
        mode: 'login',
        returnOrigin: this.returnOrigins.resolve(returnOrigin),
      };
    }

    attachVerifiedState(
      req: FastifyRequest,
      res: FastifyReply,
      queryState: string | undefined,
    ): boolean {
      const cookieState = this.getStateCookie(req);
      if (!cookieState || !queryState || !this.safeCompare(cookieState, queryState)) {
        this.logger.warn('OAuth state rejected: state mismatch or missing cookie');
        return false;
      }
      const payload = this.verifyAndDecodeState(cookieState);
      if (!payload) {
        this.logger.warn('OAuth state rejected: bad signature or expired');
        return false;
      }
      req.oauthStatePayload = payload;
      this.clearStateCookie(res);
      return true;
    }

    signState(payload: OAuthStatePayload): string {
      const json = JSON.stringify(payload);
      const data = Buffer.from(json).toString('base64url');
      const sig = createHmac('sha256', this.authCfg.stateSecret).update(data).digest('base64url');
      return `${data}.${sig}`;
    }

    verifyAndDecodeState(signedState: string): OAuthStatePayload | null {
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

    safeCompare(a: string, b: string): boolean {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) return false;
      return timingSafeEqual(bufA, bufB);
    }

    setStateCookie(res: FastifyReply, state: string): void {
      const isProd = this.authCfg.isProduction;
      (res as ReplyWithCookies).setCookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: OAUTH_STATE_TTL_MS / MS_PER_SECOND,
        path: this.getCookiePath(),
      });
    }

    getStateCookie(req: FastifyRequest): string | undefined {
      return req.cookies[OAUTH_STATE_COOKIE];
    }

    clearStateCookie(res: FastifyReply): void {
      (res as ReplyWithCookies).clearCookie(OAUTH_STATE_COOKIE, { path: this.getCookiePath() });
    }

    validateReturnTo(returnTo?: string): string | null {
      if (!returnTo) return null;
      if (!RETURN_TO_PATTERN.test(returnTo) || returnTo.startsWith('//')) {
        return null;
      }
      return returnTo;
    }
  }

  return BaseOAuthGuard;
}

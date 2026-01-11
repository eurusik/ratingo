import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  UnauthorizedException,
  Logger,
  Inject,
  HttpStatus,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { type FastifyReply, type FastifyRequest } from 'fastify';

import authConfig from '../../../../config/auth.config';

/**
 * OAuth error codes that should trigger a redirect to frontend.
 */
const REDIRECT_ERROR_CODES = new Set([
  'OAUTH_CANCELLED',
  'OAUTH_STATE_INVALID',
  'OAUTH_PROVIDER_ERROR',
  'OAUTH_EMAIL_NOT_VERIFIED',
]);

/**
 * OAuth error codes that should return JSON response.
 */
const JSON_ERROR_CODES = new Set(['OAUTH_EXCHANGE_EXPIRED', 'OAUTH_EXCHANGE_USED']);

/**
 * Exception filter for OAuth-related errors.
 * Redirect errors go to frontend, exchange errors return JSON 401.
 */
@Catch(UnauthorizedException)
export class OAuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthExceptionFilter.name);

  constructor(
    @Inject(authConfig.KEY)
    private readonly authCfg: ConfigType<typeof authConfig>,
  ) {}

  catch(exception: UnauthorizedException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const errorCode = this.extractErrorCode(exception);

    // Log OAuth error with request context (without sensitive data)
    this.logger.warn(`OAuth error: ${errorCode}`, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      path: request.url,
    });

    // Handle redirect errors (OAuth flow errors)
    if (REDIRECT_ERROR_CODES.has(errorCode)) {
      const { frontendUrl } = this.authCfg;
      const redirectUrl = `${frontendUrl}/auth/callback/google?error=${encodeURIComponent(errorCode)}`;
      void response.redirect(redirectUrl);
      return;
    }

    // Handle JSON errors (exchange errors)
    if (JSON_ERROR_CODES.has(errorCode)) {
      void response.status(HttpStatus.UNAUTHORIZED).send({
        success: false,
        error: {
          code: errorCode,
          message: this.getErrorMessage(errorCode),
          statusCode: HttpStatus.UNAUTHORIZED,
        },
      });
      return;
    }

    // For non-OAuth UnauthorizedException, let it propagate to global filter
    // by re-throwing (this filter only handles OAuth-specific errors)
    throw exception;
  }

  private extractErrorCode(exception: UnauthorizedException): string {
    const response = exception.getResponse();

    // Handle string response (our OAuth error codes)
    if (typeof response === 'string') {
      return response;
    }

    // Handle object response with message
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const { message } = response as { message: unknown };
      if (typeof message === 'string') {
        return message;
      }
    }

    return 'UNKNOWN_ERROR';
  }

  private getErrorMessage(code: string): string {
    const messages: Record<string, string> = {
      OAUTH_CANCELLED: 'Sign in was cancelled',
      OAUTH_STATE_INVALID: 'Security validation failed, please try again',
      OAUTH_PROVIDER_ERROR: 'Google sign in failed',
      OAUTH_EMAIL_NOT_VERIFIED: 'Please verify your Google email first',
      OAUTH_EXCHANGE_EXPIRED: 'Session expired, please try again',
      OAUTH_EXCHANGE_USED: 'Session already used, please try again',
    };
    return messages[code] || 'Authentication failed';
  }
}

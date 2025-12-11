import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';
import { AppException } from './app.exception';

/**
 * Exception for external API errors (502/503).
 */
export class ExternalApiException extends AppException {
  constructor(
    code: ErrorCode = ErrorCode.EXTERNAL_API_ERROR,
    message: string = 'External API error',
    details?: Record<string, any>
  ) {
    super(code, message, HttpStatus.BAD_GATEWAY, details);
  }
}

/**
 * Exception for TMDB API errors.
 */
export class TmdbApiException extends ExternalApiException {
  constructor(message: string, statusCode?: number) {
    super(ErrorCode.TMDB_API_ERROR, `TMDB API: ${message}`, { statusCode });
  }
}

/**
 * Exception for Trakt API errors.
 */
export class TraktApiException extends ExternalApiException {
  constructor(message: string, statusCode?: number) {
    super(ErrorCode.TRAKT_API_ERROR, `Trakt API: ${message}`, { statusCode });
  }
}

/**
 * Exception for OMDb API errors.
 */
export class OmdbApiException extends ExternalApiException {
  constructor(message: string, statusCode?: number) {
    super(ErrorCode.OMDB_API_ERROR, `OMDb API: ${message}`, { statusCode });
  }
}

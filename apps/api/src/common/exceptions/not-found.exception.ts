import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';
import { AppException } from './app.exception';

/**
 * Exception for resource not found errors (404).
 */
export class NotFoundException extends AppException {
  constructor(
    code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND,
    message: string = 'Resource not found',
    details?: Record<string, any>
  ) {
    super(code, message, HttpStatus.NOT_FOUND, details);
  }
}

/**
 * Exception for media not found errors.
 */
export class MediaNotFoundException extends NotFoundException {
  constructor(identifier: string | number, type: 'tmdbId' | 'id' = 'tmdbId') {
    super(ErrorCode.MEDIA_NOT_FOUND, `Media with ${type} ${identifier} not found`, {
      [type]: identifier,
    });
  }
}

/**
 * Exception for stats not found errors.
 */
export class StatsNotFoundException extends NotFoundException {
  constructor(identifier: string | number, type: 'tmdbId' | 'mediaItemId' = 'tmdbId') {
    super(ErrorCode.STATS_NOT_FOUND, `Stats for ${type} ${identifier} not found`, {
      [type]: identifier,
    });
  }
}

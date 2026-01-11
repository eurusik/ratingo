import { HttpStatus } from '@nestjs/common';

import { ErrorCode } from '../enums/error-code.enum';

import { AppException } from './app.exception';

/**
 * Exception for disabled features (422).
 *
 * Used when a feature is not configured or explicitly disabled.
 * Returns 422 Unprocessable Entity to indicate the request is valid
 * but cannot be processed due to missing configuration.
 *
 * @example
 * if (!this.config.get('S3_BUCKET')) {
 *   throw new FeatureDisabledException('Avatar upload is not configured');
 * }
 */
export class FeatureDisabledException extends AppException {
  constructor(message: string = 'Feature is not available', details?: Record<string, unknown>) {
    super(ErrorCode.FEATURE_DISABLED, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

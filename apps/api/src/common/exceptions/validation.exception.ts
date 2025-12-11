import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';
import { AppException } from './app.exception';

/**
 * Exception for validation errors (400).
 */
export class ValidationException extends AppException {
  constructor(message: string = 'Validation failed', details?: Record<string, any>) {
    super(ErrorCode.VALIDATION_ERROR, message, HttpStatus.BAD_REQUEST, details);
  }
}

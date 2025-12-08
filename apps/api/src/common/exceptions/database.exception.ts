import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';
import { AppException } from './app.exception';

/**
 * Exception for database errors (500).
 */
export class DatabaseException extends AppException {
  constructor(
    message: string = 'Database error occurred',
    details?: Record<string, any>,
  ) {
    super(ErrorCode.DATABASE_ERROR, message, HttpStatus.INTERNAL_SERVER_ERROR, details);
  }
}

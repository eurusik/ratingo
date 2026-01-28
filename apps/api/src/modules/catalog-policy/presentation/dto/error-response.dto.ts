/**
 * Error Response DTO
 *
 * Standardized error response structure for API errors.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Error details DTO.
 * Contains error code, message, and optional details.
 */
export class ErrorDetailsDto {
  @ApiProperty({
    description: 'Machine-readable error code',
    example: 'POLICY_NOT_FOUND',
  })
  code: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'Policy with id policy-123 not found',
  })
  message: string;

  @ApiProperty({
    description: 'HTTP status code',
    example: 404,
  })
  statusCode: number;

  @ApiPropertyOptional({
    description: 'Additional error details',
    example: { policyId: 'policy-123' },
  })
  details?: Record<string, unknown>;
}

/**
 * Error response DTO.
 * Standardized error response wrapper.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Indicates operation failed',
    example: false,
  })
  success: false;

  @ApiProperty({
    description: 'Error details',
    type: ErrorDetailsDto,
  })
  error: ErrorDetailsDto;
}

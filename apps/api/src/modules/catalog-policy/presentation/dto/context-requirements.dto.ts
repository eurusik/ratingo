/**
 * Context Requirements DTO
 *
 * Context-specific display requirements for policy evaluation.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Context-specific display requirements.
 * Controls readability and overview gates per display surface.
 */
export class ContextRequirementsDto {
  @ApiPropertyOptional({
    description: 'Require readable title (Latin/Cyrillic characters)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  requireReadableTitle?: boolean;

  @ApiPropertyOptional({
    description: 'Require overview presence',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requireOverview?: boolean;

  @ApiPropertyOptional({
    description: 'Minimum overview length in characters (only evaluated if requireOverview=true)',
    example: 60,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOverviewChars?: number;
}

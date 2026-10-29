import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  CATALOG_DEFAULT_CALENDAR_DAYS,
  CATALOG_MAX_CALENDAR_DAYS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../../../common/constants';

/**
 * Query parameters for GET /catalog/shows/new-episodes (public route, so bounded).
 */
export class NewEpisodesQueryDto {
  @ApiPropertyOptional({
    default: CATALOG_DEFAULT_CALENDAR_DAYS,
    minimum: 1,
    maximum: CATALOG_MAX_CALENDAR_DAYS,
    description: 'Number of days to look back.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(CATALOG_MAX_CALENDAR_DAYS)
  @Type(() => Number)
  days: number = CATALOG_DEFAULT_CALENDAR_DAYS;

  @ApiPropertyOptional({
    default: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    description: 'Max number of shows to return.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @Type(() => Number)
  limit: number = DEFAULT_PAGE_SIZE;
}

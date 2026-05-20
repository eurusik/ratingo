import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { MediaType } from '../../../../common/enums/media-type.enum';

/**
 * Query DTO for the syncTrending endpoint.
 * Replaces the mixed Body+Query pattern with a single validated query object.
 */
export class SyncTrendingQueryDto {
  @ApiPropertyOptional({
    description: 'Number of pages to fetch in dispatcher mode (20 items per page)',
    example: 5,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  pages?: number;

  @ApiPropertyOptional({
    description: 'Media type filter — sync only movies or only shows',
    enum: MediaType,
    example: MediaType.MOVIE,
  })
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;
}

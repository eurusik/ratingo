import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { DEFAULT_REGION } from '../../../../common/constants';

/**
 * DTO for single media sync request.
 */
export class SyncDto {
  @ApiProperty({ example: 550, description: 'TMDB ID of the media' })
  @IsNumber()
  @Min(1)
  tmdbId: number;

  @ApiProperty({ enum: MediaType, example: MediaType.MOVIE })
  @IsEnum(MediaType)
  type: MediaType;

  @ApiProperty({
    example: false,
    description: 'Force re-sync even if media already exists',
    required: false,
    default: false,
  })
  @IsOptional()
  force?: boolean;
}

/**
 * DTO for trending sync request.
 */
export class SyncTrendingDto {
  @ApiProperty({
    example: 5,
    description: 'Number of pages to sync (20 items per page). Use this for dispatcher mode.',
    default: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pages?: number;

  @ApiProperty({
    example: 1,
    description: 'Single page number (deprecated, use pages instead)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    example: true,
    description: 'Also sync Trakt stats after ingestion',
    default: true,
    required: false,
  })
  @IsOptional()
  syncStats?: boolean;

  @ApiProperty({
    enum: MediaType,
    description: 'Sync only specific media type (movie or show). Only for legacy single-page mode.',
    required: false,
  })
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;
}

/**
 * DTO for now playing sync request.
 */
export class SyncNowPlayingDto {
  @ApiProperty({
    example: DEFAULT_REGION,
    description: 'Region code (ISO 3166-1)',
    default: DEFAULT_REGION,
    required: false,
  })
  @IsOptional()
  region?: string;
}

/**
 * DTO for new releases sync request.
 */
export class SyncNewReleasesDto {
  @ApiProperty({
    example: DEFAULT_REGION,
    description: 'Region code (ISO 3166-1)',
    default: DEFAULT_REGION,
    required: false,
  })
  @IsOptional()
  region?: string;

  @ApiProperty({ example: 30, description: 'Days to look back', default: 30, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  daysBack?: number;

  @ApiProperty({
    example: false,
    description: 'Force re-sync even if job already exists for today',
    required: false,
    default: false,
  })
  @IsOptional()
  force?: boolean;
}

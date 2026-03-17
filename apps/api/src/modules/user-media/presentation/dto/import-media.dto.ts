import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  IMPORT_LIMITS,
  IMPORT_SOURCE,
  type ImportSource,
} from '../../domain/constants/import.constants';

/**
 * A single item in an import request, corresponding to one CSV row.
 */
export class ImportItemDto {
  /**
   * IMDB identifier (e.g. "tt1234567"). Globally unique.
   * Preferred over tmdbId for matching.
   */
  @ApiProperty({ example: 'tt1234567', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^tt\d{7,}$/, { message: 'imdbId must be a valid IMDB ID (e.g. tt1234567)' })
  @MaxLength(20)
  imdbId?: string;

  /**
   * TMDB integer identifier. Unique per type (movie vs show), not globally.
   * Used as fallback when imdbId is absent or unmatched.
   */
  @ApiProperty({ example: 550, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  tmdbId?: number;

  /**
   * Raw source rating on a 0.5-10 scale (supports half-star increments for TMDB).
   * The controller normalizes this to the internal 0-100 scale before passing
   * to the service (e.g. TMDB 7.5 → internal 75, Kinobaza 8 → internal 80).
   */
  @ApiProperty({ example: 8, required: false, nullable: true, minimum: 0.5, maximum: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(10)
  rating?: number;

  /**
   * Watch state from the source.
   * Only "completed" and "planned" are accepted from external sources.
   */
  @ApiProperty({ enum: ['completed', 'planned'], example: 'completed' })
  @IsIn(['completed', 'planned'])
  state!: 'completed' | 'planned';

  /**
   * Human-readable title from the source. Used only for logging and result reporting.
   */
  @ApiProperty({ example: 'Fight Club', required: false, nullable: true, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /**
   * Release year from the source. Used to resolve TMDB ambiguity (same ID for movie + show).
   */
  @ApiProperty({ example: 1999, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  year?: number;
}

export class ImportedItemDetailDto {
  @ApiProperty({ example: 'Fight Club', required: false, nullable: true })
  title?: string;

  @ApiProperty({ example: 'uuid-here' })
  mediaItemId!: string;

  @ApiProperty({ example: 'completed' })
  state!: string;

  @ApiProperty({ example: 80, nullable: true })
  rating!: number | null;
}

export class SkippedItemDetailDto {
  @ApiProperty({ example: 'The Matrix', required: false, nullable: true })
  title?: string;

  @ApiProperty({ example: 'already_exists' })
  reason!: string;
}

export class NotFoundItemDetailDto {
  @ApiProperty({ example: 'Obscure Film', required: false, nullable: true })
  title?: string;

  @ApiProperty({ example: 'tt9999999', required: false, nullable: true })
  imdbId?: string;

  @ApiProperty({ example: 99999, required: false, nullable: true })
  tmdbId?: number;
}

export class ImportDetailsDto {
  @ApiProperty({ type: [ImportedItemDetailDto] })
  imported!: ImportedItemDetailDto[];

  @ApiProperty({ type: [SkippedItemDetailDto] })
  skipped!: SkippedItemDetailDto[];

  @ApiProperty({ type: [NotFoundItemDetailDto] })
  notFound!: NotFoundItemDetailDto[];
}

export class PendingBatchSummaryDto {
  @ApiProperty({ example: 'uuid-here', description: 'Batch identifier for polling status' })
  batchId!: string;

  @ApiProperty({
    example: 42,
    description: 'Total number of items submitted for background auto-ingestion',
  })
  totalItems!: number;
}

export class CsvImportResultDto {
  @ApiProperty({ example: 2743, description: 'Items successfully written to the database' })
  imported!: number;

  @ApiProperty({ example: 52, description: 'Items skipped (already exist and overwrite is false)' })
  skipped!: number;

  @ApiProperty({ example: 135, description: 'Items whose media could not be found in the catalog' })
  notFound!: number;

  @ApiProperty({ example: 812, description: 'Wall-clock import duration in milliseconds' })
  durationMs!: number;

  @ApiProperty({
    type: ImportDetailsDto,
    description: 'Item-level breakdown for the result summary',
  })
  details!: ImportDetailsDto;

  @ApiPropertyOptional({
    type: PendingBatchSummaryDto,
    description:
      'Present when not-found items have been queued for background auto-ingestion. ' +
      'Poll GET /user-media/import/status for progress updates.',
  })
  pendingBatch?: PendingBatchSummaryDto;
}

export class ImportMediaDto {
  /**
   * Import source identifier.
   */
  @ApiProperty({ enum: Object.values(IMPORT_SOURCE), example: IMPORT_SOURCE.KINOBAZA })
  @IsIn(Object.values(IMPORT_SOURCE))
  source!: ImportSource;

  @ApiProperty({
    type: [ImportItemDto],
    description: `Items to import (1–${IMPORT_LIMITS.MAX_ITEMS})`,
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_LIMITS.MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => ImportItemDto)
  items!: ImportItemDto[];

  /**
   * When true, existing entries are overwritten (respecting the no-downgrade rule).
   * Defaults to false (safe: skip existing entries).
   */
  @ApiProperty({
    example: false,
    required: false,
    default: false,
    description: 'Overwrite existing ratings and states. State can never be downgraded.',
  })
  @IsOptional()
  @IsBoolean()
  overwriteExisting?: boolean;
}

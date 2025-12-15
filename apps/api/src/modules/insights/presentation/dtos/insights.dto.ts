import { ApiProperty } from '@nestjs/swagger';
import { ImageDto, ExternalRatingsDto } from '../../../catalog/presentation/dtos/common.dto';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RiseFallStatsDto {
  @ApiProperty({ description: 'Absolute change in watchers count' })
  deltaWatchers: number;

  @ApiProperty({ description: 'Percentage change in watchers count', nullable: true })
  deltaPercent: number | null;

  @ApiProperty({ description: 'Current total watchers count' })
  currentWatchers: number;

  @ApiProperty({
    description: 'Indicates if the item is new to trends (no previous history)',
    required: false,
  })
  isNewInTrends?: boolean;

  @ApiProperty({ description: 'Watchers added in the current window' })
  growthCurrent: number;

  @ApiProperty({ description: 'Watchers added in the previous window' })
  growthPrev: number;
}

export class RiseFallItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  mediaItemId: string;

  @ApiProperty({ enum: ['movie', 'show'] })
  type: 'movie' | 'show';

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  originalTitle: string | null;

  @ApiProperty({ type: ImageDto, nullable: true })
  poster: ImageDto | null;

  @ApiProperty({ type: ImageDto, nullable: true })
  backdrop: ImageDto | null;

  @ApiProperty({ type: RiseFallStatsDto })
  stats: RiseFallStatsDto;

  @ApiProperty({ type: ExternalRatingsDto, required: false })
  externalRatings?: ExternalRatingsDto;
}

export class RiseFallResponseDto {
  @ApiProperty({ enum: ['30d', '90d', '365d'] })
  window: '30d' | '90d' | '365d';

  @ApiProperty({ example: 'global' })
  region: string;

  @ApiProperty({ example: 'delta' })
  metric: string;

  @ApiProperty({ type: [RiseFallItemDto] })
  risers: RiseFallItemDto[];

  @ApiProperty({ type: [RiseFallItemDto] })
  fallers: RiseFallItemDto[];
}

export class InsightsQueryDto {
  @ApiProperty({ enum: ['30d', '90d', '365d'], default: '30d', required: false })
  @IsOptional()
  @IsEnum(['30d', '90d', '365d'])
  window?: '30d' | '90d' | '365d';

  @ApiProperty({ default: 5, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}

import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import { MONITORED_PROVIDERS } from '../../domain/constants/monitored-provider.const';
import { KEY_HEALTH_HISTORY_LIMIT } from '../../monitoring.constants';

export class KeyHealthSnapshotDto {
  @ApiProperty({ enum: MONITORED_PROVIDERS, example: 'tmdb' })
  provider!: string;

  @ApiProperty({ enum: Object.values(API_KEY_STATUS), example: 'valid' })
  status!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'HTTP status observed by the probe' })
  statusCode!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Probe latency in milliseconds' })
  latencyMs!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Error message or quota note' })
  detail!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  quotaRemaining!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  quotaLimit!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  checkedAt!: string;
}

export class ProviderFailureCountsDto {
  @ApiProperty({ description: '401/403 responses seen on live requests' })
  unauthorized!: number;

  @ApiProperty({ description: '429 responses seen on live requests' })
  rateLimited!: number;
}

export class ProviderKeyHealthDto {
  @ApiProperty({ enum: MONITORED_PROVIDERS, example: 'tmdb' })
  provider!: string;

  @ApiProperty({ type: KeyHealthSnapshotDto, nullable: true })
  latest!: KeyHealthSnapshotDto | null;

  @ApiProperty({ type: ProviderFailureCountsDto })
  failures!: ProviderFailureCountsDto;
}

export class KeyHealthDashboardDto {
  @ApiProperty({ type: [ProviderKeyHealthDto] })
  providers!: ProviderKeyHealthDto[];
}

export class KeyHealthHistoryDto {
  @ApiProperty({ enum: MONITORED_PROVIDERS, example: 'tmdb' })
  provider!: string;

  @ApiProperty({ type: [KeyHealthSnapshotDto] })
  items!: KeyHealthSnapshotDto[];
}

export class KeyHealthHistoryQueryDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 200, default: KEY_HEALTH_HISTORY_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

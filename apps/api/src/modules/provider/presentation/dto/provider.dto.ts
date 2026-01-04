/**
 * Provider DTOs
 *
 * Request/Response DTOs for provider admin endpoints.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  Max,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

import { OffsetPaginationMetaDto, OffsetPaginationQueryDto } from '../../../../common/dtos';
import {
  DISTRIBUTION_CHANNEL,
  type DistributionChannel,
  type MappingSource,
} from '../../domain/types/provider.types';

const DISTRIBUTION_CHANNEL_VALUES = Object.values(DISTRIBUTION_CHANNEL);

// ============================================================
// Provider Registry DTOs
// ============================================================

export class ProviderDto {
  @ApiProperty({ example: 'netflix', description: 'Canonical provider ID' })
  id: string;

  @ApiProperty({ example: 'Netflix', description: 'Display name' })
  displayName: string;

  @ApiPropertyOptional({ example: 'netflix', description: 'Brand group for variants' })
  brandGroup?: string | null;

  @ApiProperty({ example: true, description: 'Whether provider is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class ProvidersListDto {
  @ApiProperty({ type: [ProviderDto] })
  data: ProviderDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}

// ============================================================
// Provider Mapping DTOs
// ============================================================

export class MappingDto {
  @ApiProperty({ example: 'uuid-123', description: 'Mapping ID' })
  id: string;

  @ApiProperty({ example: 8, description: 'TMDB provider ID' })
  tmdbProviderId: number;

  @ApiProperty({ example: 'netflix', description: 'Canonical provider ID' })
  providerId: string;

  @ApiPropertyOptional({ example: 'netflix_ads', description: 'Variant ID if applicable' })
  variantId?: string | null;

  @ApiProperty({ example: 'direct', description: 'Distribution channel' })
  distributionChannel: DistributionChannel;

  @ApiProperty({ example: 'global', description: 'Region code or global' })
  region: string;

  @ApiProperty({ example: 'seed', description: 'Mapping source' })
  source: MappingSource;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class MappingsListDto {
  @ApiProperty({ type: [MappingDto] })
  data: MappingDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}

export class CreateMappingRequestDto {
  @ApiProperty({ example: 8, description: 'TMDB provider ID' })
  @IsInt()
  @Min(1)
  tmdbProviderId: number;

  @ApiProperty({ example: 'netflix', description: 'Canonical provider ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  providerId: string;

  @ApiPropertyOptional({ example: 'netflix_ads', description: 'Variant ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  variantId?: string;

  @ApiPropertyOptional({
    example: 'direct',
    description: 'Distribution channel',
    enum: DISTRIBUTION_CHANNEL_VALUES,
    default: 'direct',
  })
  @IsOptional()
  @IsIn(DISTRIBUTION_CHANNEL_VALUES)
  distributionChannel?: DistributionChannel;

  @ApiPropertyOptional({
    example: 'US',
    description: 'Region code (ISO 3166-1 alpha-2) or "global"',
    default: 'global',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  region?: string;
}

export class UpdateMappingRequestDto {
  @ApiPropertyOptional({ example: 'netflix', description: 'Canonical provider ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerId?: string;

  @ApiPropertyOptional({ example: 'netflix_ads', description: 'Variant ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  variantId?: string | null;

  @ApiPropertyOptional({
    example: 'direct',
    description: 'Distribution channel',
    enum: DISTRIBUTION_CHANNEL_VALUES,
  })
  @IsOptional()
  @IsIn(DISTRIBUTION_CHANNEL_VALUES)
  distributionChannel?: DistributionChannel;
}

// ============================================================
// Unmapped Provider DTOs
// ============================================================

export class UnmappedProviderDto {
  @ApiProperty({ example: 999, description: 'TMDB provider ID' })
  tmdbProviderId: number;

  @ApiProperty({ example: 'Unknown Streaming', description: 'Last seen provider name' })
  lastSeenName: string;

  @ApiProperty({ example: 150, description: 'Number of times seen' })
  seenCount: number;

  @ApiProperty({ description: 'Last seen timestamp' })
  lastSeenAt: Date;

  @ApiProperty({ example: ['US', 'GB'], description: 'Sample regions where seen' })
  sampleRegions: string[];

  @ApiProperty({
    example: ['Unknown Streaming', 'Unknown Stream'],
    description: 'Sample names seen',
  })
  sampleNames: string[];
}

export class UnmappedProvidersListDto {
  @ApiProperty({ type: [UnmappedProviderDto] })
  data: UnmappedProviderDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}

export class UnmappedQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({
    example: 'count',
    description: 'Sort by field',
    enum: ['count', 'lastSeen'],
    default: 'count',
  })
  @IsOptional()
  @IsIn(['count', 'lastSeen'])
  sortBy?: 'count' | 'lastSeen' = 'count';
}

// ============================================================
// Resolution Debug DTO
// ============================================================

export class ResolveQueryDto {
  @ApiProperty({ example: 8, description: 'TMDB provider ID to resolve' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  tmdbId: number;

  @ApiPropertyOptional({ example: 'US', description: 'Region for resolution' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  region?: string;
}

export class ResolveResultDto {
  @ApiProperty({ example: 8, description: 'Input TMDB provider ID' })
  tmdbProviderId: number;

  @ApiProperty({ example: 'US', description: 'Region used for resolution' })
  region: string;

  @ApiPropertyOptional({ description: 'Resolved mapping if found' })
  mapping?: MappingDto | null;

  @ApiProperty({ example: true, description: 'Whether mapping was found' })
  found: boolean;

  @ApiPropertyOptional({
    example: 'region',
    description: 'Resolution source: region-specific or global fallback',
  })
  source?: 'region' | 'global';
}

// ============================================================
// Mappings Query DTO
// ============================================================

export class MappingsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ example: 'netflix', description: 'Filter by provider ID' })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({ example: 'US', description: 'Filter by region' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: true, description: 'Include global mappings' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeGlobal?: boolean = true;
}

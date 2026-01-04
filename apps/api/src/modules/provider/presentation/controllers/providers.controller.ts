/**
 * Provider Admin Controller
 *
 * Admin endpoints for provider management:
 * - List providers from registry
 * - List/create/update/delete mappings
 * - List unmapped providers
 * - Debug resolution
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

import { DEFAULT_PAGE_SIZE } from '../../../../common/constants';
import { ProviderMappingService } from '../../application/services/provider-mapping.service';
import { ProviderRegistryService } from '../../application/services/provider-registry.service';
import { UnmappedTrackingService } from '../../application/services/unmapped-tracking.service';
import { DISTRIBUTION_CHANNEL, MAPPING_SOURCE } from '../../domain/types/provider.types';
import { GLOBAL_REGION } from '../../domain/utils/region-normalizer';
import {
  ProvidersListDto,
  MappingsListDto,
  MappingDto,
  CreateMappingRequestDto,
  UpdateMappingRequestDto,
  UnmappedProvidersListDto,
  UnmappedQueryDto,
  ResolveQueryDto,
  ResolveResultDto,
  MappingsQueryDto,
} from '../dto';

@ApiTags('Admin - Providers')
@Controller('admin/providers')
export class ProvidersController {
  constructor(
    private readonly registryService: ProviderRegistryService,
    private readonly mappingService: ProviderMappingService,
    private readonly unmappedService: UnmappedTrackingService,
  ) {}

  // ============================================================
  // Provider Registry
  // ============================================================

  /**
   * GET /admin/providers
   * Lists all providers from registry.
   */
  @Get()
  @ApiOperation({
    summary: 'List providers',
    description: 'Returns all providers from the registry with their status.',
  })
  @ApiResponse({ status: 200, type: ProvidersListDto })
  async listProviders(): Promise<ProvidersListDto> {
    const providers = await this.registryService.findAll({ includeInactive: true });

    return {
      data: providers.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        brandGroup: p.brandGroup,
        isActive: p.isActive,
        createdAt: p.createdAt,
      })),
      meta: {
        count: providers.length,
        total: providers.length,
        limit: providers.length,
        offset: 0,
        hasMore: false,
      },
    };
  }

  // ============================================================
  // Unmapped Providers
  // ============================================================

  /**
   * GET /admin/providers/unmapped
   * Lists unmapped providers sorted by count.
   */
  @Get('unmapped')
  @ApiOperation({
    summary: 'List unmapped providers',
    description:
      'Returns providers seen in TMDB data that have no mapping. Sorted by seen count descending.',
  })
  @ApiResponse({ status: 200, type: UnmappedProvidersListDto })
  async listUnmapped(@Query() query: UnmappedQueryDto): Promise<UnmappedProvidersListDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;

    const { data, total } = await this.unmappedService.findAll({
      limit,
      offset,
      sortBy: query.sortBy === 'lastSeen' ? 'lastSeenAt' : 'seenCount',
      sortOrder: 'desc',
    });

    return {
      data: data.map((u) => ({
        tmdbProviderId: u.tmdbProviderId,
        lastSeenName: u.lastSeenName,
        seenCount: u.seenCount,
        lastSeenAt: u.lastSeenAt,
        sampleRegions: u.sampleRegions,
        sampleNames: u.sampleNames,
      })),
      meta: {
        count: data.length,
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    };
  }

  // ============================================================
  // Provider Mappings
  // ============================================================

  /**
   * GET /admin/providers/mappings
   * Lists all mappings with optional filters.
   */
  @Get('mappings')
  @ApiOperation({
    summary: 'List mappings',
    description: 'Returns all provider mappings. Can filter by provider or region.',
  })
  @ApiResponse({ status: 200, type: MappingsListDto })
  async listMappings(@Query() query: MappingsQueryDto): Promise<MappingsListDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;

    const mappings = await this.mappingService.findAll({
      providerId: query.providerId,
      region: query.region,
      includeGlobal: query.includeGlobal,
    });

    // Apply pagination in memory (mappings are typically small dataset)
    const paginatedData = mappings.slice(offset, offset + limit);

    return {
      data: paginatedData.map(this.toMappingDto),
      meta: {
        count: paginatedData.length,
        total: mappings.length,
        limit,
        offset,
        hasMore: offset + paginatedData.length < mappings.length,
      },
    };
  }

  /**
   * POST /admin/providers/mappings
   * Creates a new mapping.
   */
  @Post('mappings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create mapping',
    description:
      'Creates a new TMDB to canonical provider mapping. ' +
      'After creation, affected media will be re-normalized on next sync.',
  })
  @ApiResponse({ status: 201, type: MappingDto })
  @ApiResponse({ status: 400, description: 'Invalid provider ID or mapping already exists' })
  async createMapping(@Body() dto: CreateMappingRequestDto): Promise<MappingDto> {
    // Validate provider exists
    const provider = await this.registryService.findById(dto.providerId);
    if (!provider) {
      throw new BadRequestException(`Provider '${dto.providerId}' not found in registry`);
    }

    const mapping = await this.mappingService.create({
      tmdbProviderId: dto.tmdbProviderId,
      providerId: dto.providerId,
      variantId: dto.variantId ?? null,
      distributionChannel: dto.distributionChannel ?? DISTRIBUTION_CHANNEL.DIRECT,
      region: dto.region ?? GLOBAL_REGION,
      source: MAPPING_SOURCE.MANUAL,
    });

    // Remove from unmapped tracking
    await this.unmappedService.removeByTmdbId(dto.tmdbProviderId);

    return this.toMappingDto(mapping);
  }

  /**
   * PUT /admin/providers/mappings/:id
   * Updates an existing mapping.
   */
  @Put('mappings/:id')
  @ApiOperation({
    summary: 'Update mapping',
    description: 'Updates an existing mapping. Only provided fields are updated.',
  })
  @ApiParam({ name: 'id', description: 'Mapping ID' })
  @ApiResponse({ status: 200, type: MappingDto })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async updateMapping(
    @Param('id') id: string,
    @Body() dto: UpdateMappingRequestDto,
  ): Promise<MappingDto> {
    // Validate provider if changing
    if (dto.providerId) {
      const provider = await this.registryService.findById(dto.providerId);
      if (!provider) {
        throw new BadRequestException(`Provider '${dto.providerId}' not found in registry`);
      }
    }

    const mapping = await this.mappingService.update(id, {
      providerId: dto.providerId,
      variantId: dto.variantId,
      distributionChannel: dto.distributionChannel,
    });

    if (!mapping) {
      throw new NotFoundException(`Mapping with ID '${id}' not found`);
    }

    return this.toMappingDto(mapping);
  }

  /**
   * DELETE /admin/providers/mappings/:id
   * Deletes a mapping.
   */
  @Delete('mappings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete mapping',
    description: 'Deletes a mapping. The TMDB provider will become unmapped again.',
  })
  @ApiParam({ name: 'id', description: 'Mapping ID' })
  @ApiResponse({ status: 204, description: 'Mapping deleted' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async deleteMapping(@Param('id') id: string): Promise<void> {
    const deleted = await this.mappingService.delete(id);

    if (!deleted) {
      throw new NotFoundException(`Mapping with ID '${id}' not found`);
    }
  }

  // ============================================================
  // Debug / Resolution
  // ============================================================

  /**
   * GET /admin/providers/resolve
   * Debug endpoint to test mapping resolution.
   */
  @Get('resolve')
  @ApiOperation({
    summary: 'Debug resolution',
    description:
      'Tests how a TMDB provider ID would be resolved to canonical provider. ' +
      'Useful for debugging mapping issues.',
  })
  @ApiResponse({ status: 200, type: ResolveResultDto })
  async resolveProvider(@Query() query: ResolveQueryDto): Promise<ResolveResultDto> {
    const region = query.region ?? GLOBAL_REGION;

    // Try region-specific first
    const regionMapping = await this.mappingService.findByTmdbIdAndRegion(query.tmdbId, region);

    if (regionMapping) {
      return {
        tmdbProviderId: query.tmdbId,
        region,
        found: true,
        source: region === GLOBAL_REGION ? 'global' : 'region',
        mapping: this.toMappingDto(regionMapping),
      };
    }

    // Try global fallback if region was specified
    if (region !== GLOBAL_REGION) {
      const globalMapping = await this.mappingService.findByTmdbIdAndRegion(
        query.tmdbId,
        GLOBAL_REGION,
      );

      if (globalMapping) {
        return {
          tmdbProviderId: query.tmdbId,
          region,
          found: true,
          source: 'global',
          mapping: this.toMappingDto(globalMapping),
        };
      }
    }

    return {
      tmdbProviderId: query.tmdbId,
      region,
      found: false,
      mapping: null,
    };
  }

  // ============================================================
  // Helpers
  // ============================================================

  private toMappingDto(mapping: {
    id: string;
    tmdbProviderId: number;
    providerId: string;
    variantId: string | null;
    distributionChannel: string;
    region: string;
    source: string;
    createdAt: Date;
  }): MappingDto {
    return {
      id: mapping.id,
      tmdbProviderId: mapping.tmdbProviderId,
      providerId: mapping.providerId,
      variantId: mapping.variantId,
      distributionChannel: mapping.distributionChannel as MappingDto['distributionChannel'],
      region: mapping.region,
      source: mapping.source as MappingDto['source'],
      createdAt: mapping.createdAt,
    };
  }
}

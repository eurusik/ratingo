import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

import { InsightsService } from '../../application/services/insights.service';
import { type RiseFallQuery } from '../../application/types/insights.types';
import { type InsightsQueryDto, RiseFallResponseDto } from '../dtos/insights.dto';

// Insights query defaults
const DEFAULT_WINDOW = '30d';
const DEFAULT_LIMIT = 5;

/**
 * Public insights endpoints.
 */
@ApiTags('Public: Insights')
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  /**
   * Gets biggest risers and fallers.
   *
   * @param {InsightsQueryDto} query - Query options (window, limit)
   * @returns {Promise<RiseFallResponseDto>} Movements data
   */
  @Get('movements')
  @ApiOperation({
    summary: 'Get biggest risers and fallers',
    description:
      'Returns media items with the biggest change in watchers count over the specified window.',
  })
  @ApiOkResponse({ type: RiseFallResponseDto })
  async getMovements(@Query() dto: InsightsQueryDto): Promise<RiseFallResponseDto> {
    const query: RiseFallQuery = {
      window: dto.window || DEFAULT_WINDOW,
      limit: dto.limit || DEFAULT_LIMIT,
    };

    const result = await this.insightsService.getMovements(query);

    // Domain result maps 1:1 to DTO in this case
    return result as RiseFallResponseDto;
  }
}

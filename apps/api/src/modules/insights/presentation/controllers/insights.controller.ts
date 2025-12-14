import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { InsightsService } from '../../application/services/insights.service';
import { InsightsQueryDto, RiseFallResponseDto } from '../../presentation/dtos/insights.dto';

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
  async getMovements(@Query() query: InsightsQueryDto): Promise<RiseFallResponseDto> {
    return this.insightsService.getMovements(query);
  }
}

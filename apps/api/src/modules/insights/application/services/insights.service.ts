import { Inject, Injectable } from '@nestjs/common';
import { INSIGHTS_REPOSITORY, InsightsRepository } from '../../domain/repositories/insights.repository.interface';
import { InsightsQueryDto, RiseFallResponseDto } from '../../presentation/dtos/insights.dto';

@Injectable()
export class InsightsService {
  constructor(
    @Inject(INSIGHTS_REPOSITORY)
    private readonly insightsRepository: InsightsRepository,
  ) {}

  async getMovements(query: InsightsQueryDto): Promise<RiseFallResponseDto> {
    const windowMap: Record<string, number> = {
      '30d': 30,
      '90d': 90,
      '365d': 365,
    };
    
    const windowKey = query.window || '30d';
    const windowDays = windowMap[windowKey] || 30;
    const limit = query.limit || 5;

    const { risers, fallers } = await this.insightsRepository.getMovements(windowDays, limit);

    return {
      window: windowKey,
      region: 'global',
      metric: 'delta',
      risers,
      fallers,
    };
  }
}

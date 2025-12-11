import { RiseFallItemDto } from '../../presentation/dtos/insights.dto';

export interface InsightsRepository {
  getMovements(
    windowDays: number,
    limit: number
  ): Promise<{ risers: RiseFallItemDto[]; fallers: RiseFallItemDto[] }>;
}

export const INSIGHTS_REPOSITORY = Symbol('INSIGHTS_REPOSITORY');

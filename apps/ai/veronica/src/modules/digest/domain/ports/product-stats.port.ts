import type { ProductStats } from '../entities/snapshot';
import type { SourceReading } from '../entities/source-reading';

export interface ProductStatsPort {
  read(windowEndMs: number): Promise<SourceReading<ProductStats>>;
}

export const PRODUCT_STATS_PORT = Symbol('PRODUCT_STATS_PORT');

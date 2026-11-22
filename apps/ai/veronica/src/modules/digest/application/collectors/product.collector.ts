import { Inject, Injectable } from '@nestjs/common';

import type { ProductStats } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { unavailable } from '../../domain/entities/source-reading';
import { PRODUCT_STATS_PORT, type ProductStatsPort } from '../../domain/ports/product-stats.port';

import { guarded } from './collector-helpers';

@Injectable()
export class ProductCollector {
  constructor(@Inject(PRODUCT_STATS_PORT) private readonly stats: ProductStatsPort) {}

  collect(nowMs: number): Promise<SourceReading<ProductStats>> {
    return guarded(() =>
      this.stats.read(nowMs).catch(() => unavailable<ProductStats>('джерело не відповіло')),
    );
  }
}

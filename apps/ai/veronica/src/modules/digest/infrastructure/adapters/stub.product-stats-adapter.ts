import type { ProductStats } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { unavailable } from '../../domain/entities/source-reading';
import type { ProductStatsPort } from '../../domain/ports/product-stats.port';

export class StubProductStatsAdapter implements ProductStatsPort {
  async read(): Promise<SourceReading<ProductStats>> {
    return unavailable('звіти про людей ще не підключені');
  }
}

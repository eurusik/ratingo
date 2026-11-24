import type { ProductStats } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { unavailable } from '../../domain/entities/source-reading';
import type { ProductSeriesPort, DailyValue } from '../../domain/ports/product-series.port';
import type { ProductStatsPort } from '../../domain/ports/product-stats.port';

const NOT_CONNECTED = 'звіти про людей ще не підключені';

export class StubProductStatsAdapter implements ProductStatsPort, ProductSeriesPort {
  async read(): Promise<SourceReading<ProductStats>> {
    return unavailable(NOT_CONNECTED);
  }

  async series(): Promise<SourceReading<DailyValue[]>> {
    return unavailable(NOT_CONNECTED);
  }
}

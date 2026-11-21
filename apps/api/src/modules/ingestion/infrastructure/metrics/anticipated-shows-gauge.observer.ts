import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import {
  type Meter,
  metrics,
  type ObservableCallback,
  type ObservableGauge,
} from '@opentelemetry/api';

import { MS_PER_SECOND } from '@/common/constants';
import { errorMessage } from '@/common/utils/error.utils';
import {
  ANTICIPATED_SHOWS_REPOSITORY,
  type IAnticipatedShowsRepository,
} from '@/modules/ingestion/domain/repositories/anticipated-shows.repository.interface';
import { METER_NAME, TRAKT_ANTICIPATED_FETCHED_METRIC } from '@/telemetry/telemetry.constants';

@Injectable()
export class AnticipatedShowsGaugeObserver implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnticipatedShowsGaugeObserver.name);
  private readonly meter: Meter = metrics.getMeter(METER_NAME);
  private fetchedGauge?: ObservableGauge;

  constructor(
    @Inject(ANTICIPATED_SHOWS_REPOSITORY)
    private readonly repository: IAnticipatedShowsRepository,
  ) {}

  onModuleInit(): void {
    this.fetchedGauge = this.meter.createObservableGauge(TRAKT_ANTICIPATED_FETCHED_METRIC, {
      description: 'Unix time of the stored Trakt anticipated shows snapshot',
      unit: 's',
    });
    this.fetchedGauge.addCallback(this.observe);
  }

  onModuleDestroy(): void {
    this.fetchedGauge?.removeCallback(this.observe);
  }

  private readonly observe: ObservableCallback = async (result) => {
    try {
      const fetchedAt = await this.repository.findLatestFetchedAt();
      if (fetchedAt) {
        result.observe(Math.floor(fetchedAt.getTime() / MS_PER_SECOND));
      }
    } catch (error) {
      this.logger.warn(
        `Failed to read anticipated shows snapshot for metrics: ${errorMessage(error)}`,
      );
    }
  };
}

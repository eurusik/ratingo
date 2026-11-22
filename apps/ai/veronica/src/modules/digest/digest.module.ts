import { Module } from '@nestjs/common';

import {
  GRAFANA_CONFIG,
  PRODUCT_STATS_CONFIG,
  type GrafanaConfig,
  type ProductStatsConfig,
} from '../../config/config.constants';

import { ApiKeysCollector } from './application/collectors/api-keys.collector';
import { BackupCollector } from './application/collectors/backup.collector';
import { HttpErrorsCollector } from './application/collectors/http-errors.collector';
import { InfraCollector } from './application/collectors/infra.collector';
import { ProductCollector } from './application/collectors/product.collector';
import { QueuesCollector } from './application/collectors/queues.collector';
import { SiteCollector } from './application/collectors/site.collector';
import { SchedulerCollector } from './application/collectors/scheduler.collector';
import { DigestComposeService } from './application/services/digest-compose.service';
import { DigestTextService } from './application/services/digest-text.service';
import { SnapshotService } from './application/services/snapshot.service';
import { DIGEST_RENDERER_PORT } from './domain/ports/digest-renderer.port';
import { METRICS_PORT } from './domain/ports/metrics.port';
import { PRODUCT_STATS_PORT } from './domain/ports/product-stats.port';
import { PrometheusMetricsAdapter } from './infrastructure/adapters/prometheus.metrics-adapter';
import { PostgresProductStatsAdapter } from './infrastructure/adapters/postgres.product-stats-adapter';
import { StubProductStatsAdapter } from './infrastructure/adapters/stub.product-stats-adapter';
import { TelegramDigestTemplate } from './infrastructure/templates/telegram-digest.template';

@Module({
  providers: [
    {
      provide: METRICS_PORT,
      inject: [GRAFANA_CONFIG],
      useFactory: (config: GrafanaConfig) => new PrometheusMetricsAdapter(config),
    },
    {
      provide: PRODUCT_STATS_PORT,
      inject: [PRODUCT_STATS_CONFIG],
      useFactory: (config: ProductStatsConfig) =>
        config.readerDatabaseUrl === undefined
          ? new StubProductStatsAdapter()
          : PostgresProductStatsAdapter.connect(config.readerDatabaseUrl),
    },
    { provide: DIGEST_RENDERER_PORT, useClass: TelegramDigestTemplate },
    ProductCollector,
    SiteCollector,
    QueuesCollector,
    ApiKeysCollector,
    HttpErrorsCollector,
    BackupCollector,
    InfraCollector,
    SchedulerCollector,
    SnapshotService,
    DigestTextService,
    DigestComposeService,
  ],
  exports: [DigestComposeService],
})
export class DigestModule {}

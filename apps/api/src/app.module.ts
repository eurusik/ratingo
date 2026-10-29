import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { buildAppCoreImports } from './app-core.imports';
import { buildThrottlerTiers, ThrottlerRealIpGuard } from './common/guards/throttler-realip.guard';
import { workerOnly } from './common/runtime/app-role';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HomeModule } from './modules/home/home.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { InsightsModule } from './modules/insights/insights.module';
import { JournalModule } from './modules/journal/journal.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { StatsModule } from './modules/stats/stats.module';
import { UserActionsModule } from './modules/user-actions/user-actions.module';
import { UserMediaModule } from './modules/user-media/user-media.module';
import { UsersModule } from './modules/users/users.module';
import { QueueMetricsModule } from './telemetry/queue-metrics.module';

/**
 * Root application module.
 */
@Module({
  imports: [
    // Rate Limiting - Tiered protection
    // Method-based selection: GET=default, mutations=strict. The 'auth' and 'refresh' tiers are
    // skipped everywhere except routes that opt in via @Throttle({ auth|refresh: {...} })
    // (see buildThrottlerTiers). Do NOT override 'default' with @Throttle() on mutation routes:
    // its module-level skipIf would still skip it.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: buildThrottlerTiers(config.get('THROTTLE_LIMIT', 600)), // 600 req/min (10 rps)
      }),
    }),
    ...buildAppCoreImports(),
    CatalogModule,
    IngestionModule,
    StatsModule,
    HomeModule,
    InsightsModule,
    AuthModule,
    UsersModule,
    UserMediaModule,
    UserActionsModule,
    JournalModule,
    ReviewsModule,
    HealthModule,
    ...workerOnly(QueueMetricsModule),
  ],
  providers: [
    // Global rate limiting guard with real IP extraction (Cloudflare/proxy support)
    {
      provide: APP_GUARD,
      useClass: ThrottlerRealIpGuard,
    },
  ],
})
export class AppModule {}

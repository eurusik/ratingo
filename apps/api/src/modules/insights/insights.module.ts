import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { InsightsController } from './presentation/controllers/insights.controller';
import { InsightsService } from './application/services/insights.service';
import { INSIGHTS_REPOSITORY } from './domain/repositories/insights.repository.interface';
import { DrizzleInsightsRepository } from './infrastructure/repositories/drizzle-insights.repository';

/**
 * Insights module.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [InsightsController],
  providers: [
    InsightsService,
    {
      provide: INSIGHTS_REPOSITORY,
      useClass: DrizzleInsightsRepository,
    },
  ],
  exports: [InsightsService],
})
export class InsightsModule {}

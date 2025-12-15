import { Module } from '@nestjs/common';
import { CardEnrichmentService } from './application/card-enrichment.service';

/**
 * Shared module for enriching media summaries with UI metadata.
 */
@Module({
  providers: [CardEnrichmentService],
  exports: [CardEnrichmentService],
})
export class CardsModule {}

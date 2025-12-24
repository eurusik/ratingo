/**
 * Catalog Policy Module
 *
 * NestJS module for the Catalog Policy Engine.
 * Provides policy management, evaluation services, and repositories.
 */

import { Module } from '@nestjs/common';

// Repositories
import {
  CatalogPolicyRepository,
  CATALOG_POLICY_REPOSITORY,
} from './infrastructure/repositories/catalog-policy.repository';
import {
  MediaCatalogEvaluationRepository,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
} from './infrastructure/repositories/media-catalog-evaluation.repository';

// Services
import { CatalogPolicyService } from './application/services/catalog-policy.service';
import { CatalogEvaluationService } from './application/services/catalog-evaluation.service';

@Module({
  providers: [
    // Repositories
    {
      provide: CATALOG_POLICY_REPOSITORY,
      useClass: CatalogPolicyRepository,
    },
    {
      provide: MEDIA_CATALOG_EVALUATION_REPOSITORY,
      useClass: MediaCatalogEvaluationRepository,
    },
    // Services
    CatalogPolicyService,
    CatalogEvaluationService,
  ],
  exports: [
    // Export services for use by other modules
    CatalogPolicyService,
    CatalogEvaluationService,
    // Export repository tokens for direct access if needed
    CATALOG_POLICY_REPOSITORY,
    MEDIA_CATALOG_EVALUATION_REPOSITORY,
  ],
})
export class CatalogPolicyModule {}

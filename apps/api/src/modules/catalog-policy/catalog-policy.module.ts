/**
 * Catalog Policy Module
 *
 * NestJS module for the Catalog Policy Engine.
 * Provides policy management, evaluation services, and repositories.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Constants
import { CATALOG_POLICY_QUEUE } from './catalog-policy.constants';

// Repositories
import {
  CatalogPolicyRepository,
  CATALOG_POLICY_REPOSITORY,
} from './infrastructure/repositories/catalog-policy.repository';
import {
  MediaCatalogEvaluationRepository,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
} from './infrastructure/repositories/media-catalog-evaluation.repository';
import {
  CatalogEvaluationRunRepository,
  CATALOG_EVALUATION_RUN_REPOSITORY,
} from './infrastructure/repositories/catalog-evaluation-run.repository';
import {
  PublicCatalogRepository,
  PUBLIC_CATALOG_REPOSITORY,
} from './infrastructure/repositories/public-catalog.repository';
import {
  AdminCatalogRepository,
  ADMIN_CATALOG_REPOSITORY,
} from './infrastructure/repositories/admin-catalog.repository';

// Services
import { CatalogPolicyService } from './application/services/catalog-policy.service';
import { CatalogEvaluationService } from './application/services/catalog-evaluation.service';
import { PolicyActivationService } from './application/services/policy-activation.service';
import { DiffService } from './application/services/diff.service';
import { DryRunService } from './application/services/dry-run.service';

// Workers
import { CatalogPolicyWorker } from './application/workers/catalog-policy.worker';

// Controllers
import { PolicyActivationController } from './presentation/controllers/policy-activation.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CATALOG_POLICY_QUEUE,
    }),
  ],
  controllers: [PolicyActivationController],
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
    {
      provide: CATALOG_EVALUATION_RUN_REPOSITORY,
      useClass: CatalogEvaluationRunRepository,
    },
    {
      provide: PUBLIC_CATALOG_REPOSITORY,
      useClass: PublicCatalogRepository,
    },
    {
      provide: ADMIN_CATALOG_REPOSITORY,
      useClass: AdminCatalogRepository,
    },
    // Services
    CatalogPolicyService,
    CatalogEvaluationService,
    PolicyActivationService,
    DiffService,
    DryRunService,
    // Workers
    CatalogPolicyWorker,
  ],
  exports: [
    // Export services for use by other modules
    CatalogPolicyService,
    CatalogEvaluationService,
    PolicyActivationService,
    DiffService,
    DryRunService,
    // Export repository tokens for direct access if needed
    CATALOG_POLICY_REPOSITORY,
    MEDIA_CATALOG_EVALUATION_REPOSITORY,
    CATALOG_EVALUATION_RUN_REPOSITORY,
    PUBLIC_CATALOG_REPOSITORY,
    ADMIN_CATALOG_REPOSITORY,
  ],
})
export class CatalogPolicyModule {}

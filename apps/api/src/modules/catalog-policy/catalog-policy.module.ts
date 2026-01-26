/**
 * Catalog Policy Module
 *
 * NestJS module for the Catalog Policy Engine.
 * Provides policy management, evaluation services, and repositories.
 */

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ProviderModule } from '../provider/public';

import { BatchEvaluationService } from './application/services/batch-evaluation.service';
import { CatalogEvaluationService } from './application/services/catalog-evaluation.service';
import { CatalogPolicyService } from './application/services/catalog-policy.service';
import { DiffService } from './application/services/diff.service';
import { DryRunService } from './application/services/dry-run.service';
import { PolicyActivationService } from './application/services/policy-activation.service';
import { RunAggregationService } from './application/services/run-aggregation.service';
import { RunFinalizeService } from './application/services/run-finalize.service';
import { CatalogPolicyWorker } from './application/workers/catalog-policy.worker';
import { CATALOG_POLICY_QUEUE } from './catalog-policy.constants';
import { CATALOG_POLICY_EVALUATOR } from './domain/ports/catalog-policy-evaluator.port';
import {
  POLICY_INPUT_REPOSITORY,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
  DIFF_REPOSITORY,
  DRY_RUN_REPOSITORY,
  POLICY_ACTIVATION_REPOSITORY,
  CATALOG_POLICY_REPOSITORY,
  CATALOG_EVALUATION_RUN_REPOSITORY,
} from './domain/repositories';
import {
  AdminCatalogRepository,
  ADMIN_CATALOG_REPOSITORY,
} from './infrastructure/repositories/admin-catalog.repository';
import { CatalogEvaluationRunRepository } from './infrastructure/repositories/catalog-evaluation-run.repository';
import { CatalogPolicyRepository } from './infrastructure/repositories/catalog-policy.repository';
import { DiffRepository } from './infrastructure/repositories/diff.repository';
import { DryRunRepository } from './infrastructure/repositories/dry-run.repository';
import { MediaCatalogEvaluationRepository } from './infrastructure/repositories/media-catalog-evaluation.repository';
import { PolicyActivationRepository } from './infrastructure/repositories/policy-activation.repository';
import { PolicyInputRepository } from './infrastructure/repositories/policy-input.repository';
import {
  PublicCatalogRepository,
  PUBLIC_CATALOG_REPOSITORY,
} from './infrastructure/repositories/public-catalog.repository';
import { PolicyController, RunController, DryRunController } from './presentation/controllers';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CATALOG_POLICY_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 1000 }, // Keep max 1000 or 1 hour
        removeOnFail: { age: 86400, count: 500 }, // Keep max 500 or 24 hours
      },
    }),
    ProviderModule,
  ],
  controllers: [PolicyController, RunController, DryRunController],
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
    {
      provide: POLICY_INPUT_REPOSITORY,
      useClass: PolicyInputRepository,
    },
    {
      provide: DIFF_REPOSITORY,
      useClass: DiffRepository,
    },
    {
      provide: DRY_RUN_REPOSITORY,
      useClass: DryRunRepository,
    },
    {
      provide: POLICY_ACTIVATION_REPOSITORY,
      useClass: PolicyActivationRepository,
    },
    // Services
    CatalogPolicyService,
    CatalogEvaluationService,
    BatchEvaluationService,
    // Port binding - other modules inject CATALOG_POLICY_EVALUATOR
    {
      provide: CATALOG_POLICY_EVALUATOR,
      useExisting: CatalogEvaluationService,
    },
    PolicyActivationService,
    DiffService,
    DryRunService,
    RunAggregationService,
    RunFinalizeService,
    // Workers
    CatalogPolicyWorker,
  ],
  exports: [
    // Export port token for other modules (preferred way)
    CATALOG_POLICY_EVALUATOR,
    // Export services for internal use and backward compatibility
    CatalogPolicyService,
    CatalogEvaluationService,
    BatchEvaluationService,
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

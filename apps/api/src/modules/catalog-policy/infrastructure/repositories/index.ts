/**
 * Catalog Policy Repositories - Barrel Export
 */

export {
  AdminCatalogRepository,
  ADMIN_CATALOG_REPOSITORY,
  type IAdminCatalogRepository,
  type MediaItemWithEvaluation,
  type AdminQueryOptions,
} from './admin-catalog.repository';

export { CatalogEvaluationRunRepository } from './catalog-evaluation-run.repository';

export { CatalogPolicyRepository } from './catalog-policy.repository';

// Re-export domain types for convenience
export {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  type ICatalogEvaluationRunRepository,
  type CatalogEvaluationRun,
  type CreateRunInput,
  type UpdateRunInput,
  type IncrementCountersInput,
  CATALOG_POLICY_REPOSITORY,
  type ICatalogPolicyRepository,
} from '../../domain/repositories';

export {
  MediaCatalogEvaluationRepository,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
  type IMediaCatalogEvaluationRepository,
} from './media-catalog-evaluation.repository';

export {
  PublicCatalogRepository,
  PUBLIC_CATALOG_REPOSITORY,
  type IPublicCatalogRepository,
  type PublicMediaItemRow,
  type PaginationOptions,
  type TrendingOptions,
  type SearchOptions,
  type HomepageOptions,
} from './public-catalog.repository';

export { DiffRepository } from './diff.repository';

export { DryRunRepository } from './dry-run.repository';

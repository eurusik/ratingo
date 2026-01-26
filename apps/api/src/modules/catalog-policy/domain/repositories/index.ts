/**
 * Domain Repositories Index
 */

export {
  POLICY_INPUT_REPOSITORY,
  type IPolicyInputRepository,
  type FetchBatchIdsOptions,
} from './policy-input.repository.interface';

export {
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
  type IMediaCatalogEvaluationRepository,
} from './media-catalog-evaluation.repository.interface';

export { DIFF_REPOSITORY, type IDiffRepository } from './diff.repository.interface';

export {
  DRY_RUN_REPOSITORY,
  type IDryRunRepository,
  type DryRunMediaItem,
  type CurrentEvaluation,
} from './dry-run.repository.interface';

export {
  CATALOG_POLICY_REPOSITORY,
  type ICatalogPolicyRepository,
} from './catalog-policy.repository.interface';

export {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  type ICatalogEvaluationRunRepository,
  type CatalogEvaluationRun,
  type CreateRunInput,
  type UpdateRunInput,
  type IncrementCountersInput,
  type ErrorSample,
} from './catalog-evaluation-run.repository.interface';

export {
  POLICY_ACTIVATION_REPOSITORY,
  type IPolicyActivationRepository,
  type SnapshotData,
  type CreateRunWithSnapshotInput,
  type CreateRunWithSnapshotResult,
  type PromoteRunInput,
} from './policy-activation.repository.interface';

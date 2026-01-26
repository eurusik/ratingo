/**
 * Domain Repositories Index
 *
 * Exports repository interfaces (ports) for dependency injection.
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

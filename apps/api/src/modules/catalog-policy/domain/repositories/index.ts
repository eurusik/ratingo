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

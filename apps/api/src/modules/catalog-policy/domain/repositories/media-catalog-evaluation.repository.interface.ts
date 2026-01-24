/**
 * Media Catalog Evaluation Repository Interface (Port)
 *
 * Domain port for managing media eligibility evaluations.
 * Implementation in infrastructure layer.
 */

import {
  type EligibilityStatusType,
  type EvaluationContextType,
} from '../constants/evaluation.constants';
import { type MediaCatalogEvaluation } from '../types/policy.types';

/** DI token for IMediaCatalogEvaluationRepository */
export const MEDIA_CATALOG_EVALUATION_REPOSITORY = Symbol('MEDIA_CATALOG_EVALUATION_REPOSITORY');

/**
 * Repository port for managing media catalog evaluations.
 *
 * Each evaluation is tied to a specific policyVersion AND context.
 * Key invariant: mediaItemId + policyVersion + context = unique evaluation
 */
export interface IMediaCatalogEvaluationRepository {
  /**
   * Upserts an evaluation for a media item.
   * Creates new or updates existing evaluation for the same mediaItemId + policyVersion + context.
   */
  upsert(evaluation: MediaCatalogEvaluation): Promise<MediaCatalogEvaluation>;

  /**
   * Bulk upsert evaluations (for batch processing).
   */
  bulkUpsert(evaluations: MediaCatalogEvaluation[]): Promise<number>;

  /**
   * Finds evaluation by media item ID (latest/current) for a specific context.
   * Defaults to 'catalog' context for backward compatibility.
   */
  findByMediaId(
    mediaItemId: string,
    context?: EvaluationContextType,
  ): Promise<MediaCatalogEvaluation | null>;

  /**
   * Finds evaluations by media item ID for multiple contexts (batch).
   * Returns a Map of context → evaluation for efficient lookup.
   */
  findByMediaIdForContexts(
    mediaItemId: string,
    contexts: EvaluationContextType[],
  ): Promise<Map<EvaluationContextType, MediaCatalogEvaluation>>;

  /**
   * Finds evaluation by media item ID, policy version, and context.
   */
  findByMediaIdAndPolicyVersion(
    mediaItemId: string,
    policyVersion: number,
    context?: EvaluationContextType,
  ): Promise<MediaCatalogEvaluation | null>;

  /**
   * Lists evaluations by policy version (for reports/re-evaluation).
   */
  listByPolicyVersion(
    policyVersion: number,
    options?: { limit?: number; offset?: number; context?: EvaluationContextType },
  ): Promise<MediaCatalogEvaluation[]>;

  /**
   * Finds evaluations by status (canonical lowercase).
   */
  findByStatus(
    status: EligibilityStatusType,
    options?: { limit?: number; offset?: number; context?: EvaluationContextType },
  ): Promise<MediaCatalogEvaluation[]>;

  /**
   * Counts evaluations by status for a policy version and context.
   */
  countByStatusAndPolicyVersion(
    policyVersion: number,
    context?: EvaluationContextType,
  ): Promise<Record<EligibilityStatusType, number>>;
}

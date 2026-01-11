/**
 * Property-Based Tests for Media Catalog Evaluation Repository
 *
 * Feature: multi-context-evaluation
 * Property 7: Upsert Idempotency
 *
 * For any evaluation with the same (media_item_id, policy_version, context) tuple,
 * upserting N times (N >= 1) SHALL result in exactly ONE record in the database
 * with the latest evaluation values.
 */

import * as fc from 'fast-check';

import {
  EligibilityStatus,
  EvaluationContext,
  type EligibilityStatusType,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';
import { type MediaCatalogEvaluation } from '../../domain/types/policy.types';

// ============================================================================
// In-Memory Repository for Property Testing
// ============================================================================

/**
 * In-memory implementation that mirrors the real repository's upsert behavior.
 * Uses composite key (mediaItemId, policyVersion, context) for uniqueness.
 */
class InMemoryEvaluationRepository {
  private evaluations: Map<string, MediaCatalogEvaluation> = new Map();

  private makeKey(
    mediaItemId: string,
    policyVersion: number,
    context: EvaluationContextType,
  ): string {
    return `${mediaItemId}:${policyVersion}:${context}`;
  }

  /**
   * Upserts an evaluation - creates new or updates existing.
   * Mirrors the real repository's ON CONFLICT DO UPDATE behavior.
   */
  upsert(evaluation: MediaCatalogEvaluation): MediaCatalogEvaluation {
    const key = this.makeKey(
      evaluation.mediaItemId,
      evaluation.policyVersion,
      evaluation.context ?? EvaluationContext.CATALOG,
    );

    // ON CONFLICT DO UPDATE - always overwrites with new values
    this.evaluations.set(key, {
      ...evaluation,
      context: evaluation.context ?? EvaluationContext.CATALOG,
    });

    return this.evaluations.get(key)!;
  }

  /**
   * Bulk upsert - processes each evaluation through upsert.
   */
  bulkUpsert(evaluations: MediaCatalogEvaluation[]): number {
    for (const e of evaluations) {
      this.upsert(e);
    }
    return evaluations.length;
  }

  /**
   * Finds evaluation by composite key.
   */
  findByKey(
    mediaItemId: string,
    policyVersion: number,
    context: EvaluationContextType,
  ): MediaCatalogEvaluation | null {
    const key = this.makeKey(mediaItemId, policyVersion, context);
    return this.evaluations.get(key) ?? null;
  }

  /**
   * Counts all evaluations matching the composite key.
   * Should always be 0 or 1 due to uniqueness constraint.
   */
  countByKey(mediaItemId: string, policyVersion: number, context: EvaluationContextType): number {
    const key = this.makeKey(mediaItemId, policyVersion, context);
    return this.evaluations.has(key) ? 1 : 0;
  }

  /**
   * Returns total count of all evaluations.
   */
  count(): number {
    return this.evaluations.size;
  }

  /**
   * Clears all evaluations.
   */
  clear(): void {
    this.evaluations.clear();
  }
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

const eligibilityStatusArb = fc.constantFrom<EligibilityStatusType>(
  EligibilityStatus.ELIGIBLE,
  EligibilityStatus.INELIGIBLE,
  EligibilityStatus.REVIEW,
);

const evaluationContextArb = fc.constantFrom<EvaluationContextType>(
  EvaluationContext.CATALOG,
  EvaluationContext.TRENDING,
);

const mediaItemIdArb = fc.uuid();

const policyVersionArb = fc.integer({ min: 1, max: 1000 });

const relevanceScoreArb = fc.integer({ min: 0, max: 100 });

const reasonsArb = fc.array(
  fc.constantFrom(
    'BLOCKED_COUNTRY',
    'BLOCKED_LANGUAGE',
    'NO_PROVIDER',
    'LOW_QUALITY',
    'BREAKOUT_RULE_MATCH',
  ),
  { minLength: 0, maxLength: 5 },
);

const breakoutRuleIdArb = fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined });

const runIdArb = fc.option(fc.uuid(), { nil: undefined });

/**
 * Generates a valid MediaCatalogEvaluation
 */
const evaluationArb = fc.record({
  mediaItemId: mediaItemIdArb,
  status: eligibilityStatusArb,
  reasons: reasonsArb,
  relevanceScore: relevanceScoreArb,
  policyVersion: policyVersionArb,
  breakoutRuleId: breakoutRuleIdArb,
  evaluatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  runId: runIdArb,
  context: evaluationContextArb,
});

/**
 * Generates an evaluation with fixed composite key but varying other fields.
 * Used to test that upserts update the same record.
 */
const evaluationWithFixedKeyArb = (
  mediaItemId: string,
  policyVersion: number,
  context: EvaluationContextType,
) =>
  fc.record({
    mediaItemId: fc.constant(mediaItemId),
    status: eligibilityStatusArb,
    reasons: reasonsArb,
    relevanceScore: relevanceScoreArb,
    policyVersion: fc.constant(policyVersion),
    breakoutRuleId: breakoutRuleIdArb,
    evaluatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    runId: runIdArb,
    context: fc.constant(context),
  });

// ============================================================================
// Property Tests
// ============================================================================

describe('Media Catalog Evaluation Repository - Property-Based Tests', () => {
  let repository: InMemoryEvaluationRepository;

  beforeEach(() => {
    repository = new InMemoryEvaluationRepository();
  });

  /**
   * Feature: multi-context-evaluation
   * Property 7: Upsert Idempotency
   *
   * For any evaluation with the same (media_item_id, policy_version, context) tuple,
   * upserting N times (N >= 1) SHALL result in exactly ONE record in the database
   * with the latest evaluation values.
   */
  describe('Property 7: Upsert Idempotency', () => {
    it('upserting same evaluation N times results in exactly ONE record', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          policyVersionArb,
          evaluationContextArb,
          fc.integer({ min: 1, max: 10 }),
          (mediaItemId, policyVersion, context, upsertCount) => {
            repository.clear();

            // Generate and upsert N evaluations with same key
            for (let i = 0; i < upsertCount; i++) {
              const evaluation: MediaCatalogEvaluation = {
                mediaItemId,
                status: EligibilityStatus.ELIGIBLE,
                reasons: [`reason-${i}`],
                relevanceScore: i * 10,
                policyVersion,
                breakoutRuleId: undefined,
                evaluatedAt: new Date(),
                runId: undefined,
                context,
              };
              repository.upsert(evaluation);
            }

            // Should have exactly ONE record
            const count = repository.countByKey(mediaItemId, policyVersion, context);
            expect(count).toBe(1);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('upsert preserves latest values', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          policyVersionArb,
          evaluationContextArb,
          fc.array(eligibilityStatusArb, { minLength: 2, maxLength: 5 }),
          (mediaItemId, policyVersion, context, statuses) => {
            repository.clear();

            // Upsert with different statuses
            let lastStatus: EligibilityStatusType = EligibilityStatus.ELIGIBLE;
            let lastRelevanceScore = 0;

            for (let i = 0; i < statuses.length; i++) {
              lastStatus = statuses[i];
              lastRelevanceScore = (i + 1) * 10;

              const evaluation: MediaCatalogEvaluation = {
                mediaItemId,
                status: lastStatus,
                reasons: [],
                relevanceScore: lastRelevanceScore,
                policyVersion,
                breakoutRuleId: undefined,
                evaluatedAt: new Date(),
                runId: undefined,
                context,
              };
              repository.upsert(evaluation);
            }

            // Verify latest values are preserved
            const stored = repository.findByKey(mediaItemId, policyVersion, context);
            expect(stored).not.toBeNull();
            expect(stored!.status).toBe(lastStatus);
            expect(stored!.relevanceScore).toBe(lastRelevanceScore);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('different contexts create separate records', () => {
      fc.assert(
        fc.property(mediaItemIdArb, policyVersionArb, (mediaItemId, policyVersion) => {
          repository.clear();

          // Upsert for CATALOG context
          repository.upsert({
            mediaItemId,
            status: EligibilityStatus.ELIGIBLE,
            reasons: [],
            relevanceScore: 50,
            policyVersion,
            breakoutRuleId: undefined,
            evaluatedAt: new Date(),
            runId: undefined,
            context: EvaluationContext.CATALOG,
          });

          // Upsert for TRENDING context
          repository.upsert({
            mediaItemId,
            status: EligibilityStatus.INELIGIBLE,
            reasons: ['NO_PROVIDER'],
            relevanceScore: 30,
            policyVersion,
            breakoutRuleId: undefined,
            evaluatedAt: new Date(),
            runId: undefined,
            context: EvaluationContext.TRENDING,
          });

          // Should have TWO separate records
          const catalogCount = repository.countByKey(
            mediaItemId,
            policyVersion,
            EvaluationContext.CATALOG,
          );
          const trendingCount = repository.countByKey(
            mediaItemId,
            policyVersion,
            EvaluationContext.TRENDING,
          );

          expect(catalogCount).toBe(1);
          expect(trendingCount).toBe(1);
          expect(repository.count()).toBe(2);

          // Verify each has correct values
          const catalogEval = repository.findByKey(
            mediaItemId,
            policyVersion,
            EvaluationContext.CATALOG,
          );
          const trendingEval = repository.findByKey(
            mediaItemId,
            policyVersion,
            EvaluationContext.TRENDING,
          );

          expect(catalogEval!.status).toBe(EligibilityStatus.ELIGIBLE);
          expect(trendingEval!.status).toBe(EligibilityStatus.INELIGIBLE);
        }),
        { numRuns: 100 },
      );
    });

    it('different policy versions create separate records', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          evaluationContextArb,
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 101, max: 200 }),
          (mediaItemId, context, version1, version2) => {
            repository.clear();

            // Upsert for version1
            repository.upsert({
              mediaItemId,
              status: EligibilityStatus.ELIGIBLE,
              reasons: [],
              relevanceScore: 50,
              policyVersion: version1,
              breakoutRuleId: undefined,
              evaluatedAt: new Date(),
              runId: undefined,
              context,
            });

            // Upsert for version2
            repository.upsert({
              mediaItemId,
              status: EligibilityStatus.INELIGIBLE,
              reasons: [],
              relevanceScore: 30,
              policyVersion: version2,
              breakoutRuleId: undefined,
              evaluatedAt: new Date(),
              runId: undefined,
              context,
            });

            // Should have TWO separate records
            const v1Count = repository.countByKey(mediaItemId, version1, context);
            const v2Count = repository.countByKey(mediaItemId, version2, context);

            expect(v1Count).toBe(1);
            expect(v2Count).toBe(1);
            expect(repository.count()).toBe(2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('bulk upsert is idempotent for same keys', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          policyVersionArb,
          evaluationContextArb,
          fc.integer({ min: 2, max: 10 }),
          (mediaItemId, policyVersion, context, batchSize) => {
            repository.clear();

            // Create batch with same key but different values
            const evaluations: MediaCatalogEvaluation[] = [];
            for (let i = 0; i < batchSize; i++) {
              evaluations.push({
                mediaItemId,
                status: i % 2 === 0 ? EligibilityStatus.ELIGIBLE : EligibilityStatus.INELIGIBLE,
                reasons: [],
                relevanceScore: i * 10,
                policyVersion,
                breakoutRuleId: undefined,
                evaluatedAt: new Date(),
                runId: undefined,
                context,
              });
            }

            // Bulk upsert
            repository.bulkUpsert(evaluations);

            // Should have exactly ONE record (last one wins)
            const count = repository.countByKey(mediaItemId, policyVersion, context);
            expect(count).toBe(1);

            // Verify last values are preserved
            const stored = repository.findByKey(mediaItemId, policyVersion, context);
            const lastEval = evaluations[evaluations.length - 1];
            expect(stored!.status).toBe(lastEval.status);
            expect(stored!.relevanceScore).toBe(lastEval.relevanceScore);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('repeated upserts produce same result as single upsert', () => {
      fc.assert(
        fc.property(evaluationArb, fc.integer({ min: 1, max: 5 }), (evaluation, repeatCount) => {
          repository.clear();

          // Upsert the same evaluation multiple times
          for (let i = 0; i < repeatCount; i++) {
            repository.upsert(evaluation);
          }

          // Get result after multiple upserts
          const afterMultiple = repository.findByKey(
            evaluation.mediaItemId,
            evaluation.policyVersion,
            evaluation.context ?? EvaluationContext.CATALOG,
          );

          // Clear and do single upsert
          repository.clear();
          repository.upsert(evaluation);

          const afterSingle = repository.findByKey(
            evaluation.mediaItemId,
            evaluation.policyVersion,
            evaluation.context ?? EvaluationContext.CATALOG,
          );

          // Results should be identical
          expect(afterMultiple).toEqual(afterSingle);
        }),
        { numRuns: 100 },
      );
    });
  });
});

/**
 * Initial Catalog Evaluation Script
 *
 * Runs the initial re-evaluation of all media items against the active policy.
 * This script should be run once after seeding the default policy.
 *
 * Usage:
 *   npx ts-node src/modules/catalog-policy/scripts/run-initial-evaluation.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import * as schema from '../../../database/schema';
import { eq, isNull, inArray } from 'drizzle-orm';
import { evaluateEligibility, computeRelevance } from '../domain/policy-engine';
import {
  PolicyConfig,
  MediaCatalogEvaluation,
  PolicyEngineInput,
  WatchProvidersMap,
} from '../domain/types/policy.types';
import { EligibilityStatus } from '../domain/constants/evaluation.constants';

// Configuration
const BATCH_SIZE = 100;
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://ratingo:ratingo_dev_password@localhost:5434/ratingo_v2';

interface EvaluationCounters {
  processed: number;
  eligible: number;
  ineligible: number;
  pending: number;
  review: number;
  errors: number;
}

async function main() {
  console.log('🚀 Starting Initial Catalog Evaluation');
  console.log('============================================================');

  // Connect to database
  const client = postgres(DATABASE_URL);
  const db = drizzle(client, { schema });

  try {
    // Step 1: Get active policy
    console.log('\n📋 Step 1: Fetching active policy...');
    const activePolicies = await db
      .select()
      .from(schema.catalogPolicies)
      .where(eq(schema.catalogPolicies.isActive, true))
      .limit(1);

    if (activePolicies.length === 0) {
      console.error('❌ No active policy found! Please seed the default policy first.');
      console.log('   Run: psql $DATABASE_URL -f drizzle/0013_seed_default_policy_v1.sql');
      process.exit(1);
    }

    const activePolicy = activePolicies[0];
    const policyConfig = activePolicy.policy as PolicyConfig;

    console.log(`✅ Active policy: v${activePolicy.version}`);
    console.log(`   - Allowed countries: ${policyConfig.allowedCountries.join(', ')}`);
    console.log(`   - Allowed languages: ${policyConfig.allowedLanguages.join(', ')}`);
    console.log(`   - Breakout rules: ${policyConfig.breakoutRules.length}`);

    // Step 2: Count total media items
    console.log('\n📋 Step 2: Counting media items...');
    const countResult = await db
      .select({ id: schema.mediaItems.id })
      .from(schema.mediaItems)
      .where(isNull(schema.mediaItems.deletedAt));

    const totalItems = countResult.length;
    console.log(`✅ Total media items to evaluate: ${totalItems}`);

    // Step 3: Process in batches
    console.log('\n📋 Step 3: Evaluating media items...');

    const counters: EvaluationCounters = {
      processed: 0,
      eligible: 0,
      ineligible: 0,
      pending: 0,
      review: 0,
      errors: 0,
    };

    let offset = 0;
    const startTime = Date.now();

    while (offset < totalItems) {
      // Get batch of media items
      const batch = await db
        .select({ id: schema.mediaItems.id })
        .from(schema.mediaItems)
        .where(isNull(schema.mediaItems.deletedAt))
        .limit(BATCH_SIZE)
        .offset(offset);

      const mediaItemIds = batch.map((row) => row.id);

      // Build inputs for batch
      const inputs = await buildBatchInputs(db, mediaItemIds);

      // Evaluate each item
      const evaluations: MediaCatalogEvaluation[] = [];

      for (const input of inputs) {
        try {
          const evalResult = evaluateEligibility(input, policyConfig);
          const relevanceScore = computeRelevance(input, policyConfig);

          const evaluation: MediaCatalogEvaluation = {
            mediaItemId: input.mediaItem.id,
            status: evalResult.status,
            reasons: evalResult.reasons,
            relevanceScore,
            policyVersion: activePolicy.version,
            breakoutRuleId: evalResult.breakoutRuleId,
            evaluatedAt: new Date(),
          };

          evaluations.push(evaluation);

          // Count by status using constants
          switch (evalResult.status) {
            case EligibilityStatus.ELIGIBLE:
              counters.eligible++;
              break;
            case EligibilityStatus.INELIGIBLE:
              counters.ineligible++;
              break;
            case EligibilityStatus.PENDING:
              counters.pending++;
              break;
            case EligibilityStatus.REVIEW:
              counters.review++;
              break;
          }

          counters.processed++;
        } catch (error) {
          console.error(`   ❌ Error evaluating ${input.mediaItem.id}:`, error);
          counters.errors++;
        }
      }

      // Bulk upsert evaluations
      if (evaluations.length > 0) {
        await bulkUpsertEvaluations(db, evaluations);
      }

      // Progress update
      const progress = Math.round((counters.processed / totalItems) * 100);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(
        `\r   Progress: ${counters.processed}/${totalItems} (${progress}%) - ${elapsed}s elapsed`,
      );

      offset += BATCH_SIZE;
    }

    console.log('\n');

    // Step 4: Summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('============================================================');
    console.log('✅ Evaluation Complete!');
    console.log('============================================================');
    console.log(`\n📊 Summary:`);
    console.log(`   Total processed: ${counters.processed}`);
    console.log(
      `   ✅ Eligible:     ${counters.eligible} (${((counters.eligible / counters.processed) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   ❌ Ineligible:   ${counters.ineligible} (${((counters.ineligible / counters.processed) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   ⏳ Pending:      ${counters.pending} (${((counters.pending / counters.processed) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   🔍 Review:       ${counters.review} (${((counters.review / counters.processed) * 100).toFixed(1)}%)`,
    );
    console.log(`   ⚠️  Errors:       ${counters.errors}`);
    console.log(`\n   Time: ${totalTime}s`);
    console.log(`   Policy version: v${activePolicy.version}`);

    // Step 5: Verify public_media_items view
    console.log('\n📋 Step 5: Verifying public_media_items view...');

    // Count eligible items in evaluations table
    const eligibleCount = await db
      .select({ id: schema.mediaCatalogEvaluations.mediaItemId })
      .from(schema.mediaCatalogEvaluations)
      .where(eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE));

    console.log(`   Eligible items in evaluations: ${eligibleCount.length}`);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function buildBatchInputs(
  db: ReturnType<typeof drizzle>,
  mediaItemIds: string[],
): Promise<PolicyEngineInput[]> {
  if (mediaItemIds.length === 0) {
    return [];
  }

  const result = await db
    .select({
      // Media item fields
      id: schema.mediaItems.id,
      originCountries: schema.mediaItems.originCountries,
      originalLanguage: schema.mediaItems.originalLanguage,
      watchProviders: schema.mediaItems.watchProviders,
      // Ratings from media_items
      ratingImdb: schema.mediaItems.ratingImdb,
      ratingMetacritic: schema.mediaItems.ratingMetacritic,
      ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
      ratingTrakt: schema.mediaItems.ratingTrakt,
      voteCountImdb: schema.mediaItems.voteCountImdb,
      voteCountTrakt: schema.mediaItems.voteCountTrakt,
      // Stats from media_stats
      qualityScore: schema.mediaStats.qualityScore,
      popularityScore: schema.mediaStats.popularityScore,
      freshnessScore: schema.mediaStats.freshnessScore,
      ratingoScore: schema.mediaStats.ratingoScore,
    })
    .from(schema.mediaItems)
    .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
    .where(inArray(schema.mediaItems.id, mediaItemIds));

  return result.map((row) => ({
    mediaItem: {
      id: row.id,
      originCountries: row.originCountries as string[] | null,
      originalLanguage: row.originalLanguage,
      watchProviders: row.watchProviders as WatchProvidersMap | null,
      voteCountImdb: row.voteCountImdb,
      voteCountTrakt: row.voteCountTrakt,
      ratingImdb: row.ratingImdb,
      ratingMetacritic: row.ratingMetacritic,
      ratingRottenTomatoes: row.ratingRottenTomatoes,
      ratingTrakt: row.ratingTrakt,
    },
    stats:
      row.qualityScore !== null
        ? {
            qualityScore: row.qualityScore,
            popularityScore: row.popularityScore,
            freshnessScore: row.freshnessScore,
            ratingoScore: row.ratingoScore,
          }
        : null,
  }));
}

async function bulkUpsertEvaluations(
  db: ReturnType<typeof drizzle>,
  evaluations: MediaCatalogEvaluation[],
): Promise<void> {
  const { sql } = await import('drizzle-orm');

  const values = evaluations.map((e) => ({
    mediaItemId: e.mediaItemId,
    status: e.status as 'pending' | 'eligible' | 'ineligible' | 'review',
    reasons: e.reasons,
    relevanceScore: e.relevanceScore,
    policyVersion: e.policyVersion,
    breakoutRuleId: e.breakoutRuleId,
    evaluatedAt: e.evaluatedAt,
  }));

  await db
    .insert(schema.mediaCatalogEvaluations)
    .values(values)
    .onConflictDoUpdate({
      target: schema.mediaCatalogEvaluations.mediaItemId,
      set: {
        status: sql`excluded.status`,
        reasons: sql`excluded.reasons`,
        relevanceScore: sql`excluded.relevance_score`,
        policyVersion: sql`excluded.policy_version`,
        breakoutRuleId: sql`excluded.breakout_rule_id`,
        evaluatedAt: sql`excluded.evaluated_at`,
      },
    });
}

// Run the script
main().catch(console.error);

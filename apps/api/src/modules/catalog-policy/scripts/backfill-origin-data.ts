/**
 * Backfill Origin Data Script
 *
 * Fetches origin_countries and original_language from TMDB for items
 * that are currently PENDING due to missing origin data.
 *
 * Usage:
 *   npx ts-node src/modules/catalog-policy/scripts/backfill-origin-data.ts
 *
 * Options:
 *   --limit=N     Process only N items (default: all)
 *   --dry-run     Show what would be updated without making changes
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import * as schema from '../../../database/schema';
import { eq, or, isNull, sql } from 'drizzle-orm';

// Configuration
const BATCH_SIZE = 10; // TMDB rate limit friendly
const DELAY_BETWEEN_REQUESTS_MS = 100; // ~10 req/sec
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://ratingo:ratingo_dev_password@localhost:5434/ratingo_v2';
const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.TMDB_READ_ACCESS_TOKEN;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface BackfillCounters {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface TmdbMovieDetails {
  id: number;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  original_language?: string;
}

interface TmdbShowDetails {
  id: number;
  origin_country?: string[];
  original_language?: string;
}

async function fetchTmdbDetails(
  tmdbId: number,
  mediaType: 'movie' | 'show',
): Promise<{ originCountries: string[] | null; originalLanguage: string | null } | null> {
  const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
  // Support both Bearer token and api_key query param
  const isReadAccessToken = TMDB_API_KEY && TMDB_API_KEY.length > 40;
  const url = isReadAccessToken
    ? `${TMDB_BASE_URL}/${endpoint}/${tmdbId}`
    : `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (isReadAccessToken) {
      headers['Authorization'] = `Bearer ${TMDB_API_KEY}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Item not found on TMDB
      }
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();

    if (mediaType === 'movie') {
      const movie = data as TmdbMovieDetails;
      return {
        originCountries: movie.production_countries?.map((c) => c.iso_3166_1.toUpperCase()) || null,
        originalLanguage: movie.original_language?.toLowerCase() || null,
      };
    } else {
      const show = data as TmdbShowDetails;
      return {
        originCountries: show.origin_country?.map((c) => c.toUpperCase()) || null,
        originalLanguage: show.original_language?.toLowerCase() || null,
      };
    }
  } catch (error) {
    console.error(`   ❌ TMDB fetch error for ${mediaType}/${tmdbId}:`, error);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const dryRun = args.includes('--dry-run');

  console.log('🚀 Backfill Origin Data');
  console.log('============================================================');

  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY or TMDB_READ_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - no changes will be made');
  }

  // Connect to database
  const client = postgres(DATABASE_URL);
  const db = drizzle(client, { schema });

  try {
    // Step 1: Find items with missing origin data
    console.log('\n📋 Step 1: Finding items with missing origin data...');

    let query = db
      .select({
        id: schema.mediaItems.id,
        tmdbId: schema.mediaItems.tmdbId,
        type: schema.mediaItems.type,
        title: schema.mediaItems.title,
        originCountries: schema.mediaItems.originCountries,
        originalLanguage: schema.mediaItems.originalLanguage,
      })
      .from(schema.mediaItems)
      .where(
        or(
          isNull(schema.mediaItems.originCountries),
          sql`${schema.mediaItems.originCountries} = '[]'::jsonb`,
          sql`${schema.mediaItems.originCountries} = 'null'::jsonb`,
        ),
      );

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    const itemsToBackfill = await query;

    console.log(`✅ Found ${itemsToBackfill.length} items with missing origin data`);

    if (itemsToBackfill.length === 0) {
      console.log('\n✅ Nothing to backfill!');
      await client.end();
      return;
    }

    // Step 2: Process items
    console.log('\n📋 Step 2: Fetching data from TMDB...');

    const counters: BackfillCounters = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    const startTime = Date.now();

    for (let i = 0; i < itemsToBackfill.length; i++) {
      const item = itemsToBackfill[i];
      counters.processed++;

      // Fetch from TMDB
      const tmdbData = await fetchTmdbDetails(item.tmdbId, item.type as 'movie' | 'show');

      if (!tmdbData) {
        counters.skipped++;
        continue;
      }

      // Check if we got useful data
      if (!tmdbData.originCountries || tmdbData.originCountries.length === 0) {
        counters.skipped++;
        continue;
      }

      // Update database
      if (!dryRun) {
        await db
          .update(schema.mediaItems)
          .set({
            originCountries: tmdbData.originCountries,
            originalLanguage: tmdbData.originalLanguage || item.originalLanguage,
            updatedAt: new Date(),
          })
          .where(eq(schema.mediaItems.id, item.id));
      }

      counters.updated++;

      // Progress update
      if (counters.processed % 10 === 0 || counters.processed === itemsToBackfill.length) {
        const progress = Math.round((counters.processed / itemsToBackfill.length) * 100);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stdout.write(
          `\r   Progress: ${counters.processed}/${itemsToBackfill.length} (${progress}%) - Updated: ${counters.updated}, Skipped: ${counters.skipped} - ${elapsed}s`,
        );
      }

      // Rate limiting
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }

    console.log('\n');

    // Step 3: Summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('============================================================');
    console.log(dryRun ? '✅ Dry Run Complete!' : '✅ Backfill Complete!');
    console.log('============================================================');
    console.log(`\n📊 Summary:`);
    console.log(`   Total processed: ${counters.processed}`);
    console.log(`   ✅ Updated:      ${counters.updated}`);
    console.log(`   ⏭️  Skipped:      ${counters.skipped} (no data on TMDB)`);
    console.log(`   ❌ Errors:       ${counters.errors}`);
    console.log(`\n   Time: ${totalTime}s`);

    if (!dryRun && counters.updated > 0) {
      console.log('\n💡 Next step: Run re-evaluation to update eligibility status:');
      console.log('   npx ts-node src/modules/catalog-policy/scripts/run-initial-evaluation.ts');
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
main().catch(console.error);

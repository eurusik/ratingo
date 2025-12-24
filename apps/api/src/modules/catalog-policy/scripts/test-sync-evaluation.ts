/**
 * Test script: Verify sync triggers evaluation
 *
 * Usage: npx ts-node --transpile-only src/modules/catalog-policy/scripts/test-sync-evaluation.ts
 */

import 'dotenv/config';
import * as postgres from 'postgres';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://ratingo:ratingo_dev_password@localhost:5434/ratingo_v2';

async function main() {
  const sql = (postgres as any)(DATABASE_URL);

  console.log('🔍 Checking evaluation for tmdb_id=200875 (Воно: Ласкаво просимо в Деррі)...\n');

  // Get media item
  const mediaItem = await sql`
    SELECT id, title, tmdb_id, origin_countries, original_language
    FROM media_items
    WHERE tmdb_id = 200875 AND type = 'show'
  `;

  if (mediaItem.length === 0) {
    console.log('❌ Media item not found');
    await sql.end();
    return;
  }

  const item = mediaItem[0];
  console.log('📺 Media Item:');
  console.log(`   ID: ${item.id}`);
  console.log(`   Title: ${item.title}`);
  console.log(`   Origin Countries: ${JSON.stringify(item.origin_countries)}`);
  console.log(`   Original Language: ${item.original_language}`);

  // Get evaluation
  const evaluation = await sql`
    SELECT media_item_id, policy_version, status, reasons, relevance_score, evaluated_at
    FROM media_catalog_evaluations
    WHERE media_item_id = ${item.id}
    ORDER BY policy_version DESC
  `;

  console.log('\n📊 Evaluations:');
  if (evaluation.length === 0) {
    console.log('   ❌ No evaluations found');
  } else {
    for (const e of evaluation) {
      console.log(
        `   Policy v${e.policy_version}: ${e.status} | Reasons: ${e.reasons} | Score: ${e.relevance_score} | At: ${e.evaluated_at || 'never'}`,
      );
    }
  }

  // Get active policy
  const activePolicy = await sql`
    SELECT version FROM catalog_policies WHERE is_active = true
  `;
  console.log(`\n🎯 Active Policy: v${activePolicy[0]?.version || 'NONE'}`);

  // Check if evaluation exists for active policy
  const hasActiveEval = evaluation.some((e) => e.policy_version === activePolicy[0]?.version);
  if (!hasActiveEval && activePolicy[0]) {
    console.log(`\n⚠️  No evaluation for active policy v${activePolicy[0].version}!`);
    console.log('   This item will NOT appear in public_media_items view.');
  }

  await sql.end();
}

main().catch(console.error);

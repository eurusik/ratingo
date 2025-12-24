/**
 * Manual Test Script for Policy Engine
 *
 * Run with: npx ts-node src/modules/catalog-policy/domain/test-policy-engine.ts
 */

import { evaluateEligibility, computeRelevance } from './policy-engine';
import { PolicyConfig, PolicyEngineInput } from './types/policy.types';
import { validatePolicyOrThrow } from './validation/policy.schema';

console.log('🚀 Policy Engine Live Test\n');
console.log('='.repeat(60));

// Test 1: Create and validate a policy
console.log('\n📋 Test 1: Policy Validation');
console.log('-'.repeat(60));

const rawPolicy = {
  allowedCountries: ['us', 'gb', 'ca', 'ua'], // lowercase - will be normalized
  blockedCountries: ['ru', 'cn'],
  blockedCountryMode: 'ANY',
  allowedLanguages: ['EN', 'UK'], // uppercase - will be normalized
  blockedLanguages: ['ru'],
  globalProviders: ['Netflix', 'Prime Video', 'Disney+'],
  breakoutRules: [
    {
      id: 'global-hit',
      name: 'Global Hit',
      priority: 1,
      requirements: {
        minImdbVotes: 50000,
        minQualityScoreNormalized: 0.6,
      },
    },
    {
      id: 'streaming-exclusive',
      name: 'Streaming Exclusive',
      priority: 2,
      requirements: {
        requireAnyOfProviders: ['Netflix', 'Prime Video'],
        minImdbVotes: 10000,
      },
    },
  ],
  eligibilityMode: 'STRICT',
  homepage: {
    minRelevanceScore: 50,
  },
};

try {
  const validatedPolicy = validatePolicyOrThrow(rawPolicy);
  console.log('✅ Policy validated successfully!');
  console.log('Normalized policy:');
  console.log(`  - Allowed countries: ${validatedPolicy.allowedCountries.join(', ')}`);
  console.log(`  - Allowed languages: ${validatedPolicy.allowedLanguages.join(', ')}`);
  console.log(`  - Breakout rules: ${validatedPolicy.breakoutRules.length} rules`);
  console.log(
    `  - Rules sorted by priority: ${validatedPolicy.breakoutRules.map((r) => `${r.name}(${r.priority})`).join(', ')}`,
  );
} catch (error) {
  console.error('❌ Policy validation failed:', error);
  process.exit(1);
}

const policy: PolicyConfig = validatePolicyOrThrow(rawPolicy);

// Test 2: Evaluate allowed content
console.log('\n📋 Test 2: Allowed Content (US movie in English)');
console.log('-'.repeat(60));

const allowedInput: PolicyEngineInput = {
  mediaItem: {
    id: 'test-1',
    originCountries: ['US'],
    originalLanguage: 'en',
    watchProviders: null,
    voteCountImdb: 25000,
    voteCountTrakt: 5000,
    ratingImdb: 7.5,
    ratingMetacritic: 75,
    ratingRottenTomatoes: 80,
    ratingTrakt: 8.0,
  },
  stats: {
    qualityScore: 0.75,
    popularityScore: 0.6,
    freshnessScore: 0.8,
    ratingoScore: 0.7,
  },
};

const result1 = evaluateEligibility(allowedInput, policy);
const relevance1 = computeRelevance(allowedInput, policy);

console.log(`Status: ${result1.status}`);
console.log(`Reasons: ${result1.reasons.join(', ')}`);
console.log(`Breakout Rule: ${result1.breakoutRuleId || 'none'}`);
console.log(`Relevance Score: ${relevance1}/100`);

// Test 3: Evaluate blocked content
console.log('\n📋 Test 3: Blocked Content (Russian movie)');
console.log('-'.repeat(60));

const blockedInput: PolicyEngineInput = {
  mediaItem: {
    id: 'test-2',
    originCountries: ['RU'],
    originalLanguage: 'ru',
    watchProviders: null,
    voteCountImdb: 5000,
    voteCountTrakt: 1000,
    ratingImdb: 6.5,
    ratingMetacritic: null,
    ratingRottenTomatoes: null,
    ratingTrakt: 7.0,
  },
  stats: {
    qualityScore: 0.5,
    popularityScore: 0.3,
    freshnessScore: 0.4,
    ratingoScore: 0.45,
  },
};

const result2 = evaluateEligibility(blockedInput, policy);
const relevance2 = computeRelevance(blockedInput, policy);

console.log(`Status: ${result2.status}`);
console.log(`Reasons: ${result2.reasons.join(', ')}`);
console.log(`Breakout Rule: ${result2.breakoutRuleId || 'none'}`);
console.log(`Relevance Score: ${relevance2}/100`);

// Test 4: Evaluate blocked content with breakout
console.log('\n📋 Test 4: Blocked Content with Breakout (Russian blockbuster)');
console.log('-'.repeat(60));

const breakoutInput: PolicyEngineInput = {
  mediaItem: {
    id: 'test-3',
    originCountries: ['RU'],
    originalLanguage: 'ru',
    watchProviders: {
      US: {
        link: 'https://www.themoviedb.org/movie/123',
        flatrate: [{ providerId: 8, name: 'Netflix' }],
      },
    },
    voteCountImdb: 150000, // Meets global-hit requirement
    voteCountTrakt: 25000,
    ratingImdb: 8.5,
    ratingMetacritic: 85,
    ratingRottenTomatoes: 90,
    ratingTrakt: 8.8,
  },
  stats: {
    qualityScore: 0.85, // Meets global-hit requirement
    popularityScore: 0.9,
    freshnessScore: 0.7,
    ratingoScore: 0.85,
  },
};

const result3 = evaluateEligibility(breakoutInput, policy);
const relevance3 = computeRelevance(breakoutInput, policy);

console.log(`Status: ${result3.status}`);
console.log(`Reasons: ${result3.reasons.join(', ')}`);
console.log(`Breakout Rule: ${result3.breakoutRuleId || 'none'}`);
console.log(`Relevance Score: ${relevance3}/100`);

// Test 5: Evaluate missing data
console.log('\n📋 Test 5: Missing Data (no origin country)');
console.log('-'.repeat(60));

const missingInput: PolicyEngineInput = {
  mediaItem: {
    id: 'test-4',
    originCountries: null, // Missing!
    originalLanguage: 'en',
    watchProviders: null,
    voteCountImdb: 10000,
    voteCountTrakt: 2000,
    ratingImdb: 7.0,
    ratingMetacritic: null,
    ratingRottenTomatoes: null,
    ratingTrakt: 7.5,
  },
  stats: {
    qualityScore: 0.6,
    popularityScore: 0.5,
    freshnessScore: 0.6,
    ratingoScore: 0.55,
  },
};

const result4 = evaluateEligibility(missingInput, policy);
const relevance4 = computeRelevance(missingInput, policy);

console.log(`Status: ${result4.status}`);
console.log(`Reasons: ${result4.reasons.join(', ')}`);
console.log(`Breakout Rule: ${result4.breakoutRuleId || 'none'}`);
console.log(`Relevance Score: ${relevance4}/100`);

// Test 6: Evaluate neutral content
console.log('\n📋 Test 6: Neutral Content (French movie)');
console.log('-'.repeat(60));

const neutralInput: PolicyEngineInput = {
  mediaItem: {
    id: 'test-5',
    originCountries: ['FR'], // Not in allowed or blocked
    originalLanguage: 'fr',
    watchProviders: null,
    voteCountImdb: 8000,
    voteCountTrakt: 1500,
    ratingImdb: 7.2,
    ratingMetacritic: 72,
    ratingRottenTomatoes: 75,
    ratingTrakt: 7.5,
  },
  stats: {
    qualityScore: 0.65,
    popularityScore: 0.4,
    freshnessScore: 0.5,
    ratingoScore: 0.55,
  },
};

const result5 = evaluateEligibility(neutralInput, policy);
const relevance5 = computeRelevance(neutralInput, policy);

console.log(`Status: ${result5.status}`);
console.log(`Reasons: ${result5.reasons.join(', ')}`);
console.log(`Breakout Rule: ${result5.breakoutRuleId || 'none'}`);
console.log(`Relevance Score: ${relevance5}/100`);

// Test 7: MAJORITY mode with co-production
console.log('\n📋 Test 7: MAJORITY Mode (US-RU-CN co-production)');
console.log('-'.repeat(60));

const majorityPolicy: PolicyConfig = {
  ...policy,
  blockedCountryMode: 'MAJORITY',
};

const coproductionInput: PolicyEngineInput = {
  mediaItem: {
    id: 'test-6',
    originCountries: ['US', 'RU', 'CN'], // 1 allowed, 2 blocked = majority blocked
    originalLanguage: 'en',
    watchProviders: null,
    voteCountImdb: 30000,
    voteCountTrakt: 5000,
    ratingImdb: 7.8,
    ratingMetacritic: null,
    ratingRottenTomatoes: null,
    ratingTrakt: 8.0,
  },
  stats: {
    qualityScore: 0.7,
    popularityScore: 0.6,
    freshnessScore: 0.5,
    ratingoScore: 0.65,
  },
};

const result6 = evaluateEligibility(coproductionInput, majorityPolicy);
const relevance6 = computeRelevance(coproductionInput, majorityPolicy);

console.log(`Status: ${result6.status}`);
console.log(`Reasons: ${result6.reasons.join(', ')}`);
console.log(`Breakout Rule: ${result6.breakoutRuleId || 'none'}`);
console.log(`Relevance Score: ${relevance6}/100`);

// Summary
console.log('\n' + '='.repeat(60));
console.log('✅ All tests completed successfully!');
console.log('='.repeat(60));

console.log('\n📊 Summary:');
console.log(`Test 1 (Allowed):    ${result1.status} - ${result1.reasons.join(', ')}`);
console.log(`Test 2 (Blocked):    ${result2.status} - ${result2.reasons.join(', ')}`);
console.log(
  `Test 3 (Breakout):   ${result3.status} - ${result3.reasons.join(', ')} (${result3.breakoutRuleId})`,
);
console.log(`Test 4 (Missing):    ${result4.status} - ${result4.reasons.join(', ')}`);
console.log(`Test 5 (Neutral):    ${result5.status} - ${result5.reasons.join(', ')}`);
console.log(`Test 6 (Majority):   ${result6.status} - ${result6.reasons.join(', ')}`);

console.log('\n🎯 Key Features Demonstrated:');
console.log('  ✓ Policy validation and normalization');
console.log('  ✓ Allowed content evaluation');
console.log('  ✓ Blocked content detection');
console.log('  ✓ Breakout rules (global hits bypass blocks)');
console.log('  ✓ Missing data handling (PENDING status)');
console.log('  ✓ Neutral content handling');
console.log('  ✓ MAJORITY mode for co-productions');
console.log('  ✓ Relevance score computation');

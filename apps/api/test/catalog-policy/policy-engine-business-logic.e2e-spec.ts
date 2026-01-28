/**
 * Policy Engine Business Logic E2E Tests
 *
 * Tests the core business rules of the policy engine through the dry-run API.
 * These tests verify that the policy engine correctly evaluates content based on:
 * - Country/language filtering (HARD vs SOFT filters)
 * - Breakout rules and priority ordering
 * - Content classification
 * - Global requirements
 * - Context-specific requirements
 */

import { createCatalogPolicyApp, CatalogPolicyE2eContext, createTestPolicy } from './_harness';
import type { DryRunMediaItem } from '../../src/modules/catalog-policy/domain/repositories/dry-run.repository.interface';

// ============================================================================
// Test Data Factories
// ============================================================================

function createMediaItem(overrides: Partial<DryRunMediaItem> = {}): DryRunMediaItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: 'Test Movie',
    overview: 'A test movie with enough content for the overview check to pass easily.',
    originCountries: ['US'],
    originalLanguage: 'en',
    contentClass: 'mainstream',
    ratingImdb: 7.5,
    ratingMetacritic: 75,
    ratingRottenTomatoes: 80,
    ratingTrakt: 7.8,
    voteCountImdb: 50000,
    voteCountTrakt: 10000,
    qualityScore: 75,
    popularityScore: 60,
    freshnessScore: 50,
    ratingoScore: 70,
    watchersCount: null,
    ...overrides,
  };
}

// Real-world inspired test items
const SQUID_GAME = createMediaItem({
  id: 'squid-game',
  title: 'Squid Game',
  originCountries: ['KR'],
  originalLanguage: 'ko',
  contentClass: 'mainstream',
  voteCountImdb: 800000,
  qualityScore: 85,
  ratingoScore: 88,
});

const PARASITE = createMediaItem({
  id: 'parasite',
  title: 'Parasite',
  originCountries: ['KR'],
  originalLanguage: 'ko',
  contentClass: 'mainstream',
  voteCountImdb: 900000,
  qualityScore: 95,
  ratingoScore: 92,
});

const ATTACK_ON_TITAN = createMediaItem({
  id: 'attack-on-titan',
  title: 'Attack on Titan',
  originCountries: ['JP'],
  originalLanguage: 'ja',
  contentClass: 'anime',
  voteCountImdb: 600000,
  qualityScore: 90,
  ratingoScore: 88,
});

const RUSSIAN_MOVIE = createMediaItem({
  id: 'russian-movie',
  title: 'Some Russian Movie',
  originCountries: ['RU'],
  originalLanguage: 'ru',
  contentClass: 'mainstream',
  voteCountImdb: 100000,
  qualityScore: 70,
  ratingoScore: 65,
});

const RUSSIAN_BLOCKBUSTER = createMediaItem({
  id: 'russian-blockbuster',
  title: 'Russian Blockbuster',
  originCountries: ['RU'],
  originalLanguage: 'ru',
  contentClass: 'mainstream',
  voteCountImdb: 1000000, // Very high votes
  qualityScore: 85,
  ratingoScore: 80,
});

const US_MOVIE = createMediaItem({
  id: 'us-movie',
  title: 'American Movie',
  originCountries: ['US'],
  originalLanguage: 'en',
  contentClass: 'mainstream',
  voteCountImdb: 50000,
  qualityScore: 70,
  ratingoScore: 68,
});

const CO_PRODUCTION_US_RU = createMediaItem({
  id: 'co-prod-us-ru',
  title: 'US-Russia Co-Production',
  originCountries: ['US', 'RU'],
  originalLanguage: 'en',
  contentClass: 'mainstream',
  voteCountImdb: 30000,
  qualityScore: 65,
  ratingoScore: 60,
});

const CO_PRODUCTION_MAJORITY_BLOCKED = createMediaItem({
  id: 'co-prod-majority-blocked',
  title: 'Mostly Blocked Countries',
  originCountries: ['RU', 'BY', 'US'],
  originalLanguage: 'ru',
  contentClass: 'mainstream',
  voteCountImdb: 30000,
  qualityScore: 65,
  ratingoScore: 60,
});

const LOW_QUALITY_MOVIE = createMediaItem({
  id: 'low-quality',
  title: 'Low Quality Movie',
  originCountries: ['US'],
  originalLanguage: 'en',
  contentClass: 'mainstream',
  voteCountImdb: 500,
  qualityScore: 30,
  ratingoScore: 25,
});

const ANIME_POPULAR = createMediaItem({
  id: 'anime-popular',
  title: 'Popular Anime',
  originCountries: ['JP'],
  originalLanguage: 'ja',
  contentClass: 'anime',
  voteCountImdb: 300000,
  qualityScore: 80,
  ratingoScore: 78,
});

const ANIME_OBSCURE = createMediaItem({
  id: 'anime-obscure',
  title: 'Obscure Anime',
  originCountries: ['JP'],
  originalLanguage: 'ja',
  contentClass: 'anime',
  voteCountImdb: 5000,
  qualityScore: 60,
  ratingoScore: 55,
});

const DOCUMENTARY = createMediaItem({
  id: 'documentary',
  title: 'Nature Documentary',
  originCountries: ['GB'],
  originalLanguage: 'en',
  contentClass: 'documentary',
  voteCountImdb: 20000,
  qualityScore: 75,
  ratingoScore: 72,
});

const MISSING_METADATA = createMediaItem({
  id: 'missing-metadata',
  title: 'Movie Without Country',
  originCountries: null,
  originalLanguage: null,
  contentClass: null,
  voteCountImdb: 50000,
  qualityScore: 70,
  ratingoScore: 65,
});

// Local Maturity Override test items - fresh content with local engagement
const FRESH_WITH_WATCHERS = createMediaItem({
  id: 'fresh-with-watchers',
  title: 'Knight of the Seven Kingdoms',
  originCountries: ['US'],
  originalLanguage: 'en',
  contentClass: 'mainstream',
  voteCountImdb: 500, // Low - fails minVotesAnyOf
  voteCountTrakt: 367, // Low - fails minVotesAnyOf
  qualityScore: 80,
  freshnessScore: 95, // High freshness (0.95 normalized)
  watchersCount: 69, // Strong local engagement
  ratingoScore: 75,
});

const FRESH_LOW_WATCHERS = createMediaItem({
  id: 'fresh-low-watchers',
  title: 'New Show Low Engagement',
  originCountries: ['US'],
  originalLanguage: 'en',
  contentClass: 'mainstream',
  voteCountImdb: 500, // Low
  voteCountTrakt: 300, // Low
  qualityScore: 70,
  freshnessScore: 95, // High freshness
  watchersCount: 10, // Too few watchers
  ratingoScore: 65,
});

const OLD_WITH_WATCHERS = createMediaItem({
  id: 'old-with-watchers',
  title: 'Old Show With Engagement',
  originCountries: ['US'],
  originalLanguage: 'en',
  contentClass: 'mainstream',
  voteCountImdb: 500, // Low
  voteCountTrakt: 400, // Low
  qualityScore: 75,
  freshnessScore: 30, // Low freshness - old content
  watchersCount: 100, // High watchers
  ratingoScore: 70,
});

const HIGH_VOTES_LOW_FRESHNESS = createMediaItem({
  id: 'high-votes-low-freshness',
  title: 'Established Hit',
  originCountries: ['US'],
  originalLanguage: 'en',
  contentClass: 'mainstream',
  voteCountImdb: 100000, // High - passes minVotesAnyOf
  voteCountTrakt: 50000, // High
  qualityScore: 85,
  freshnessScore: 20, // Low freshness
  watchersCount: 5, // Low watchers - doesn't matter since votes pass
  ratingoScore: 80,
});

// ============================================================================
// Tests
// ============================================================================

describe('Policy Engine Business Logic (e2e)', () => {
  let ctx: CatalogPolicyE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogPolicyApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(() => {
    ctx.dryRunRepo.clear();
  });

  // ==========================================================================
  // HARD vs SOFT Filters
  // ==========================================================================

  describe('HARD Filters (Blocked Country/Language)', () => {
    it('should mark content from blocked country as INELIGIBLE', async () => {
      ctx.dryRunRepo.setItems([RUSSIAN_MOVIE, US_MOVIE]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA', 'GB'],
            blockedCountries: ['RU', 'BY'],
            allowedLanguages: ['en', 'uk'],
            blockedLanguages: ['ru'],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const russianItem = res.body.data.items.find((i: any) => i.mediaItemId === 'russian-movie');
      const usItem = res.body.data.items.find((i: any) => i.mediaItemId === 'us-movie');

      expect(russianItem.proposedStatus).toBe('ineligible');
      expect(russianItem.reasons).toContain('BLOCKED_COUNTRY');
      expect(usItem.proposedStatus).toBe('eligible');
    });

    it('should NOT allow breakout to override blocked country (HARD filter)', async () => {
      // Even with extremely high votes, blocked country content should stay ineligible
      ctx.dryRunRepo.setItems([RUSSIAN_BLOCKBUSTER]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en', 'uk'],
            blockedLanguages: ['ru'],
            breakoutRules: [
              {
                id: 'global-phenomenon',
                name: 'Global Phenomenon',
                priority: 0,
                requirements: {
                  minImdbVotes: 500000, // Russian Blockbuster has 1M votes
                },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.reasons).toContain('BLOCKED_COUNTRY');
      expect(item.breakoutRuleId).toBeNull(); // Breakout should NOT be applied
    });

    it('should mark content with blocked language as INELIGIBLE', async () => {
      const russianLanguageItem = createMediaItem({
        id: 'neutral-country-ru-lang',
        originCountries: ['FR'], // France - neutral
        originalLanguage: 'ru', // Russian language - blocked
        voteCountImdb: 100000,
      });

      ctx.dryRunRepo.setItems([russianLanguageItem]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en', 'uk'],
            blockedLanguages: ['ru'],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.reasons).toContain('BLOCKED_LANGUAGE');
    });
  });

  // ==========================================================================
  // Breakout Rules (SOFT Filter Override)
  // ==========================================================================

  describe('Breakout Rules', () => {
    it('should allow breakout for neutral country content with high votes', async () => {
      ctx.dryRunRepo.setItems([SQUID_GAME]); // Korean - neutral country

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en', 'uk'],
            blockedLanguages: ['ru'],
            breakoutRules: [
              {
                id: 'global-phenomenon',
                name: 'Global Phenomenon',
                priority: 0,
                requirements: {
                  minImdbVotes: 500000,
                },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('eligible');
      expect(item.reasons).toContain('BREAKOUT_ALLOWED');
      expect(item.breakoutRuleId).toBe('global-phenomenon');
    });

    it('should respect breakout rule priority (first match wins)', async () => {
      ctx.dryRunRepo.setItems([PARASITE]); // 900k votes

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
            breakoutRules: [
              {
                id: 'global-phenomenon',
                name: 'Global Phenomenon',
                priority: 0,
                requirements: { minImdbVotes: 500000 },
              },
              {
                id: 'viral-hit',
                name: 'Viral Hit',
                priority: 1,
                requirements: { minImdbVotes: 100000 },
              },
              {
                id: 'notable',
                name: 'Notable',
                priority: 2,
                requirements: { minImdbVotes: 50000 },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.breakoutRuleId).toBe('global-phenomenon'); // Highest priority that matches
    });

    it('should fallback to lower priority breakout rule', async () => {
      const mediumPopularItem = createMediaItem({
        id: 'medium-popular',
        originCountries: ['KR'],
        originalLanguage: 'ko',
        voteCountImdb: 200000, // Matches viral-hit but not global-phenomenon
      });

      ctx.dryRunRepo.setItems([mediumPopularItem]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
            breakoutRules: [
              {
                id: 'global-phenomenon',
                name: 'Global Phenomenon',
                priority: 0,
                requirements: { minImdbVotes: 500000 },
              },
              {
                id: 'viral-hit',
                name: 'Viral Hit',
                priority: 1,
                requirements: { minImdbVotes: 100000 },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.breakoutRuleId).toBe('viral-hit'); // Falls back to viral-hit
    });

    it('should deny neutral content that does not meet any breakout rule', async () => {
      const lowVotesNeutral = createMediaItem({
        id: 'low-votes-neutral',
        originCountries: ['KR'],
        originalLanguage: 'ko',
        voteCountImdb: 10000, // Too low for breakout
      });

      ctx.dryRunRepo.setItems([lowVotesNeutral]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
            breakoutRules: [
              {
                id: 'viral-hit',
                name: 'Viral Hit',
                priority: 0,
                requirements: { minImdbVotes: 100000 },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.breakoutRuleId).toBeNull();
    });

    it('should support combined breakout requirements', async () => {
      const highVotesLowQuality = createMediaItem({
        id: 'high-votes-low-quality',
        originCountries: ['KR'],
        originalLanguage: 'ko',
        voteCountImdb: 600000, // High votes
        qualityScore: 40, // Low quality (0.4 normalized)
      });

      ctx.dryRunRepo.setItems([highVotesLowQuality]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
            breakoutRules: [
              {
                id: 'quality-hit',
                name: 'Quality Hit',
                priority: 0,
                requirements: {
                  minImdbVotes: 500000,
                  minQualityScoreNormalized: 0.7, // Requires 70% quality
                },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      // Should be ineligible because quality is too low
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.breakoutRuleId).toBeNull();
    });
  });

  // ==========================================================================
  // MAJORITY Mode for Co-Productions
  // ==========================================================================

  describe('MAJORITY Mode (Co-Productions)', () => {
    it('should block content if ANY country is blocked in ANY mode', async () => {
      ctx.dryRunRepo.setItems([CO_PRODUCTION_US_RU]); // US + RU

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA'],
            blockedCountries: ['RU'],
            blockedCountryMode: 'ANY', // Any blocked = blocked
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.reasons).toContain('BLOCKED_COUNTRY');
    });

    it('should allow content if minority of countries are blocked in MAJORITY mode', async () => {
      const coProductionMinorityBlocked = createMediaItem({
        id: 'co-prod-minority-blocked',
        originCountries: ['US', 'GB', 'RU'], // 1 out of 3 blocked
        originalLanguage: 'en',
        voteCountImdb: 50000,
      });

      ctx.dryRunRepo.setItems([coProductionMinorityBlocked]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'GB'],
            blockedCountries: ['RU'],
            blockedCountryMode: 'MAJORITY', // Majority must be blocked
            allowedLanguages: ['en'],
            blockedLanguages: [],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      // Only 1/3 blocked, majority (2/3) are allowed - should be eligible
      expect(item.proposedStatus).toBe('eligible');
    });

    it('should block content if majority of countries are blocked in MAJORITY mode', async () => {
      ctx.dryRunRepo.setItems([CO_PRODUCTION_MAJORITY_BLOCKED]); // RU, BY, US - 2/3 blocked

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA'],
            blockedCountries: ['RU', 'BY'],
            blockedCountryMode: 'MAJORITY',
            allowedLanguages: ['en', 'ru'], // Allow Russian language to isolate country test
            blockedLanguages: [],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      // 2/3 blocked (RU, BY) - should be blocked
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.reasons).toContain('BLOCKED_COUNTRY');
    });
  });

  // ==========================================================================
  // Content Classification
  // ==========================================================================

  describe('Content Classification', () => {
    it('should allow popular anime to breakout', async () => {
      ctx.dryRunRepo.setItems([ATTACK_ON_TITAN]); // 600k votes

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
            excludedContentClasses: ['anime'], // Anime is excluded
            breakoutRules: [
              {
                id: 'global-phenomenon',
                name: 'Global Phenomenon',
                priority: 0,
                requirements: { minImdbVotes: 500000 },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      // Anime is SOFT excluded, can be overridden by breakout
      expect(item.proposedStatus).toBe('eligible');
      expect(item.breakoutRuleId).toBe('global-phenomenon');
    });

    it('should block obscure anime when anime is excluded', async () => {
      ctx.dryRunRepo.setItems([ANIME_OBSCURE]); // Only 5k votes

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'JP'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en', 'ja'],
            blockedLanguages: ['ru'],
            excludedContentClasses: ['anime'],
            breakoutRules: [
              {
                id: 'viral-hit',
                name: 'Viral Hit',
                priority: 0,
                requirements: { minImdbVotes: 100000 },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      // Low votes, can't breakout
      expect(item.proposedStatus).toBe('ineligible');
    });

    it('should allow documentary from allowed country', async () => {
      ctx.dryRunRepo.setItems([DOCUMENTARY]); // GB origin

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'GB'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('eligible');
    });
  });

  // ==========================================================================
  // Data Integrity Gate
  // ==========================================================================

  describe('Data Integrity Gate', () => {
    it('should mark content with missing origin country as ineligible', async () => {
      ctx.dryRunRepo.setItems([MISSING_METADATA]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.reasons).toContain('MISSING_ORIGIN_COUNTRY');
    });

    it('should mark content without any ratings as ineligible when required', async () => {
      const noRatings = createMediaItem({
        id: 'no-ratings',
        originCountries: ['US'],
        originalLanguage: 'en',
        voteCountImdb: null,
        voteCountTrakt: null,
        ratingImdb: null,
        ratingTrakt: null,
      });

      ctx.dryRunRepo.setItems([noRatings]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
            globalRequirements: {
              appliesTo: ['catalog'],
              minVotesAnyOf: {
                min: 1000,
                sources: ['imdb', 'trakt'],
              },
            },
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
    });
  });

  // ==========================================================================
  // Global Requirements Gate
  // ==========================================================================

  describe('Global Requirements Gate', () => {
    it('should apply minimum quality score requirement', async () => {
      ctx.dryRunRepo.setItems([LOW_QUALITY_MOVIE]); // qualityScore: 30

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
            globalRequirements: {
              appliesTo: ['catalog'],
              minQualityScoreNormalized: 0.5, // 50% minimum
            },
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
    });

    it('should apply minimum votes requirement', async () => {
      const lowVotes = createMediaItem({
        id: 'low-votes',
        originCountries: ['US'],
        originalLanguage: 'en',
        voteCountImdb: 500, // Very low
        voteCountTrakt: 500, // Also low - must set both since minVotesAnyOf checks any source
        qualityScore: 70,
      });

      ctx.dryRunRepo.setItems([lowVotes]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
            globalRequirements: {
              appliesTo: ['catalog'],
              minVotesAnyOf: {
                min: 1000,
                sources: ['imdb', 'trakt'],
              },
            },
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
    });
  });

  // ==========================================================================
  // Eligibility Mode (STRICT vs RELAXED)
  // ==========================================================================

  describe('Eligibility Mode', () => {
    it('should require allowed country in STRICT mode', async () => {
      const neutralCountry = createMediaItem({
        id: 'neutral-no-breakout',
        originCountries: ['FR'], // Neutral - not in allowed list
        originalLanguage: 'fr',
        voteCountImdb: 30000, // Not enough for breakout
      });

      ctx.dryRunRepo.setItems([neutralCountry]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en', 'uk'],
            blockedLanguages: ['ru'],
            eligibilityMode: 'STRICT',
            breakoutRules: [
              {
                id: 'viral-hit',
                name: 'Viral Hit',
                priority: 0,
                requirements: { minImdbVotes: 100000 },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
    });

    it('should allow neutral country in RELAXED mode', async () => {
      const neutralCountry = createMediaItem({
        id: 'neutral-relaxed',
        originCountries: ['FR'],
        originalLanguage: 'en', // Allowed language
        voteCountImdb: 30000,
        qualityScore: 70,
      });

      ctx.dryRunRepo.setItems([neutralCountry]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en', 'uk'],
            blockedLanguages: ['ru'],
            eligibilityMode: 'RELAXED',
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      // In RELAXED mode, neutral countries with allowed language can be eligible
      expect(item.proposedStatus).toBe('eligible');
    });
  });

  // ==========================================================================
  // Reason Breakdown
  // ==========================================================================

  describe('Reason Breakdown', () => {
    it('should provide accurate reason breakdown for mixed items', async () => {
      ctx.dryRunRepo.setItems([
        US_MOVIE, // Allowed
        RUSSIAN_MOVIE, // Blocked country
        MISSING_METADATA, // Missing data
        SQUID_GAME, // Breakout
      ]);

      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en', 'uk'],
            blockedLanguages: ['ru'],
            breakoutRules: [
              {
                id: 'global-phenomenon',
                name: 'Global Phenomenon',
                priority: 0,
                requirements: { minImdbVotes: 500000 },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      expect(res.body.data.summary.eligible).toBeGreaterThanOrEqual(2); // US + Squid Game
      expect(res.body.data.summary.ineligible).toBeGreaterThanOrEqual(2); // Russian + Missing

      const breakdown = res.body.data.summary.reasonBreakdown;
      expect(breakdown).toBeDefined();
      expect(Array.isArray(breakdown)).toBe(true);
    });
  });

  // ==========================================================================
  // Local Maturity Override (Fresh Content with Local Engagement)
  // ==========================================================================

  describe('Local Maturity Override', () => {
    const localMaturityPolicy = createTestPolicy({
      allowedCountries: ['US', 'UA'],
      blockedCountries: ['RU'],
      allowedLanguages: ['en', 'uk'],
      blockedLanguages: ['ru'],
      globalRequirements: {
        appliesTo: ['catalog'],
        minVotesAnyOf: {
          min: 1000, // Requires 1000 votes from IMDb or Trakt
          sources: ['imdb', 'trakt'],
        },
        localMaturityOverride: {
          minFreshnessScoreNormalized: 0.9, // 90% freshness (score >= 90)
          minLocalWatchers: 30, // At least 30 Ratingo users watching
        },
      },
    });

    it('should allow fresh content with local engagement despite low votes', async () => {
      ctx.dryRunRepo.setItems([FRESH_WITH_WATCHERS]);

      const res = await ctx
        .post('/dry-run', {
          policy: localMaturityPolicy,
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('eligible');
      expect(item.reasons).toContain('ALLOWED_LOCAL_MATURITY');
    });

    it('should reject fresh content with insufficient local watchers', async () => {
      ctx.dryRunRepo.setItems([FRESH_LOW_WATCHERS]);

      const res = await ctx
        .post('/dry-run', {
          policy: localMaturityPolicy,
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.reasons).toContain('MISSING_GLOBAL_SIGNALS');
    });

    it('should reject old content with local watchers (freshness too low)', async () => {
      ctx.dryRunRepo.setItems([OLD_WITH_WATCHERS]);

      const res = await ctx
        .post('/dry-run', {
          policy: localMaturityPolicy,
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.reasons).toContain('MISSING_GLOBAL_SIGNALS');
    });

    it('should allow content with high votes regardless of freshness/watchers', async () => {
      ctx.dryRunRepo.setItems([HIGH_VOTES_LOW_FRESHNESS]);

      const res = await ctx
        .post('/dry-run', {
          policy: localMaturityPolicy,
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('eligible');
      // Should NOT have ALLOWED_LOCAL_MATURITY since votes passed directly
      expect(item.reasons).not.toContain('ALLOWED_LOCAL_MATURITY');
    });

    it('should work correctly with mixed items', async () => {
      ctx.dryRunRepo.setItems([
        FRESH_WITH_WATCHERS, // Should pass via local maturity
        FRESH_LOW_WATCHERS, // Should fail - low watchers
        OLD_WITH_WATCHERS, // Should fail - low freshness
        HIGH_VOTES_LOW_FRESHNESS, // Should pass via votes
      ]);

      const res = await ctx
        .post('/dry-run', {
          policy: localMaturityPolicy,
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const items = res.body.data.items;

      const freshWithWatchers = items.find((i: any) => i.mediaItemId === 'fresh-with-watchers');
      const freshLowWatchers = items.find((i: any) => i.mediaItemId === 'fresh-low-watchers');
      const oldWithWatchers = items.find((i: any) => i.mediaItemId === 'old-with-watchers');
      const highVotes = items.find((i: any) => i.mediaItemId === 'high-votes-low-freshness');

      expect(freshWithWatchers.proposedStatus).toBe('eligible');
      expect(freshLowWatchers.proposedStatus).toBe('ineligible');
      expect(oldWithWatchers.proposedStatus).toBe('ineligible');
      expect(highVotes.proposedStatus).toBe('eligible');

      // Summary should show 2 eligible, 2 ineligible
      expect(res.body.data.summary.eligible).toBe(2);
      expect(res.body.data.summary.ineligible).toBe(2);
    });

    it('should NOT apply local maturity override when not configured', async () => {
      ctx.dryRunRepo.setItems([FRESH_WITH_WATCHERS]);

      const policyWithoutOverride = createTestPolicy({
        allowedCountries: ['US'],
        blockedCountries: ['RU'],
        allowedLanguages: ['en'],
        blockedLanguages: ['ru'],
        globalRequirements: {
          appliesTo: ['catalog'],
          minVotesAnyOf: {
            min: 1000,
            sources: ['imdb', 'trakt'],
          },
          // No localMaturityOverride configured
        },
      });

      const res = await ctx
        .post('/dry-run', {
          policy: policyWithoutOverride,
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.proposedStatus).toBe('ineligible');
      expect(item.reasons).toContain('MISSING_GLOBAL_SIGNALS');
    });
  });
});

/**
 * Catalog Policy Schema Validation
 *
 * Zod schemas for validating and normalizing policy configurations.
 * Ensures policy data is valid before storage and execution.
 */

import { z } from 'zod';

import { type ContentClass, VALID_CONTENT_CLASSES } from '../classification.service';
import { PolicyValidationError } from '../errors';
import { type PolicyConfig } from '../types/policy.types';

/**
 * Breakout rule schema
 */
const BreakoutRuleSchema = z.object({
  id: z.string().min(1, 'Breakout rule ID is required'),
  name: z.string().min(1, 'Breakout rule name is required'),
  priority: z.number().int().min(0, 'Priority must be a non-negative integer'),
  requirements: z.object({
    minImdbVotes: z.number().int().min(0).optional(),
    minTraktVotes: z.number().int().min(0).optional(),
    minQualityScoreNormalized: z.number().min(0).max(1).optional(),
    requireAnyOfProviders: z.array(z.string()).optional(),
    requireAnyOfRatingsPresent: z.array(z.enum(['imdb', 'metacritic', 'rt', 'trakt'])).optional(),
  }),
});

/**
 * Global requirements schema
 */
// Schema validation constants
const MAX_RELEVANCE_SCORE = 100;

const GlobalRequirementsSchema = z.object({
  minQualityScoreNormalized: z.number().min(0).max(1).optional(),
  requireAnyOfRatingsPresent: z.array(z.enum(['imdb', 'metacritic', 'rt', 'trakt'])).optional(),
  minVotesAnyOf: z
    .object({
      sources: z.array(z.enum(['imdb', 'trakt'])).min(1),
      min: z.number().int().min(0),
    })
    .optional(),
  appliesTo: z
    .array(z.enum(['catalog', 'homepage', 'trending', 'now_playing', 'new_digital', 'search']))
    .optional(),
});

/**
 * Policy configuration schema
 */
const PolicyConfigSchema = z.object({
  allowedCountries: z.array(
    z.string().length(2, 'Country codes must be 2 characters (ISO 3166-1 alpha-2)'),
  ),
  blockedCountries: z.array(
    z.string().length(2, 'Country codes must be 2 characters (ISO 3166-1 alpha-2)'),
  ),
  blockedCountryMode: z.enum(['ANY', 'MAJORITY']),
  allowedLanguages: z.array(
    z.string().length(2, 'Language codes must be 2 characters (ISO 639-1)'),
  ),
  blockedLanguages: z.array(
    z.string().length(2, 'Language codes must be 2 characters (ISO 639-1)'),
  ),
  globalProviders: z.array(z.string()),
  breakoutRules: z.array(BreakoutRuleSchema),
  eligibilityMode: z.enum(['STRICT', 'RELAXED']),
  homepage: z.object({
    minRelevanceScore: z
      .number()
      .min(0)
      .max(MAX_RELEVANCE_SCORE, 'Relevance score must be between 0 and 100'),
  }),
  globalRequirements: GlobalRequirementsSchema.optional(),
  excludedContentClasses: z
    .array(z.enum(VALID_CONTENT_CLASSES as [string, ...string[]]))
    .optional()
    .default([]),
});

/**
 * Validates and normalizes a policy configuration
 *
 * Normalization steps:
 * 1. Uppercase all country codes
 * 2. Lowercase all language codes
 * 3. Sort breakout rules by priority (ascending)
 * 4. Apply defaults where needed
 *
 * @param policy - Raw policy configuration object
 * @returns Validated and normalized PolicyConfig
 * @throws ZodError if validation fails
 */
export function validatePolicyOrThrow(policy: unknown): PolicyConfig {
  // First, validate the structure
  const validated = PolicyConfigSchema.parse(policy);

  // Normalize the data
  const normalized: PolicyConfig = {
    ...validated,
    // Uppercase country codes
    allowedCountries: validated.allowedCountries.map((c) => c.toUpperCase()),
    blockedCountries: validated.blockedCountries.map((c) => c.toUpperCase()),
    // Lowercase language codes
    allowedLanguages: validated.allowedLanguages.map((l) => l.toLowerCase()),
    blockedLanguages: validated.blockedLanguages.map((l) => l.toLowerCase()),
    // Sort breakout rules by priority (ascending - lower number = higher priority)
    breakoutRules: [...validated.breakoutRules].sort((a, b) => a.priority - b.priority),
    // Pass through excludedContentClasses
    excludedContentClasses: validated.excludedContentClasses as ContentClass[],
  };

  // Additional business logic validations
  validateBusinessRules(normalized);

  return normalized;
}

/**
 * Additional business logic validations that go beyond schema structure
 */
function validateBusinessRules(policy: PolicyConfig): void {
  // Check for overlapping allowed/blocked countries
  const blockedSet = new Set(policy.blockedCountries);
  const countryOverlap = policy.allowedCountries.filter((c) => blockedSet.has(c));

  if (countryOverlap.length > 0) {
    throw new PolicyValidationError(
      `Countries cannot be both allowed and blocked: ${countryOverlap.join(', ')}`,
      { overlappingCountries: countryOverlap },
    );
  }

  // Check for overlapping allowed/blocked languages
  const blockedLangSet = new Set(policy.blockedLanguages);
  const langOverlap = policy.allowedLanguages.filter((l) => blockedLangSet.has(l));

  if (langOverlap.length > 0) {
    throw new PolicyValidationError(
      `Languages cannot be both allowed and blocked: ${langOverlap.join(', ')}`,
      { overlappingLanguages: langOverlap },
    );
  }

  // Check for duplicate breakout rule IDs
  const ruleIds = policy.breakoutRules.map((r) => r.id);
  const uniqueIds = new Set(ruleIds);

  if (ruleIds.length !== uniqueIds.size) {
    throw new PolicyValidationError('Breakout rule IDs must be unique', {
      duplicateIds: ruleIds.filter((id, i) => ruleIds.indexOf(id) !== i),
    });
  }

  // Check for duplicate breakout rule priorities
  const priorities = policy.breakoutRules.map((r) => r.priority);
  const uniquePriorities = new Set(priorities);

  if (priorities.length !== uniquePriorities.size) {
    throw new PolicyValidationError('Breakout rule priorities must be unique', {
      duplicatePriorities: priorities.filter((p, i) => priorities.indexOf(p) !== i),
    });
  }

  // Ensure at least one requirement is specified for each breakout rule
  for (const rule of policy.breakoutRules) {
    const hasRequirement = Object.keys(rule.requirements).length > 0;
    if (!hasRequirement) {
      throw new PolicyValidationError(
        `Breakout rule "${rule.name}" (${rule.id}) must have at least one requirement`,
        { ruleId: rule.id, ruleName: rule.name },
      );
    }
  }
}

/**
 * Type guard to check if a value is a valid PolicyConfig
 */
export function isPolicyConfig(value: unknown): value is PolicyConfig {
  try {
    validatePolicyOrThrow(value);
    return true;
  } catch {
    return false;
  }
}

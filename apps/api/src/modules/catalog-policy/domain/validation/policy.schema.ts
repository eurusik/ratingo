/**
 * Policy configuration validation using Zod schemas.
 * Validates structure, normalizes data, and enforces business rules.
 */

import { z } from 'zod';

import { VALID_CONTENT_CLASSES } from '../classification.service';
import { EvaluationContext } from '../constants/evaluation.constants';
import { PolicyValidationError } from '../errors';
import { type PolicyConfig } from '../types/policy.types';

// Schema validation constants
const MIN_OVERVIEW_CHARS = 0;
const MAX_OVERVIEW_CHARS = 1000;
const MAX_RELEVANCE_SCORE = 100;

const VALID_CONTEXTS = Object.values(EvaluationContext) as [string, ...string[]];
const VALID_RATING_SOURCES = ['imdb', 'metacritic', 'rt', 'trakt'] as const;
const VALID_VOTE_SOURCES = ['imdb', 'trakt'] as const;

/** Breakout rule requirements schema. */
const BreakoutRuleSchema = z.object({
  id: z.string().min(1, 'Breakout rule ID is required'),
  name: z.string().min(1, 'Breakout rule name is required'),
  priority: z.number().int().min(0, 'Priority must be a non-negative integer'),
  requirements: z.object({
    minImdbVotes: z.number().int().min(0).optional(),
    minTraktVotes: z.number().int().min(0).optional(),
    minQualityScoreNormalized: z.number().min(0).max(1).optional(),
    requireAnyOfProviders: z.array(z.string()).optional(),
    requireAnyOfRatingsPresent: z.array(z.enum(VALID_RATING_SOURCES)).optional(),
    originCountries: z
      .array(z.string().length(2, 'Country codes must be 2 characters (ISO 3166-1 alpha-2)'))
      .optional(),
    excludeOriginCountries: z
      .array(z.string().length(2, 'Country codes must be 2 characters (ISO 3166-1 alpha-2)'))
      .optional(),
  }),
});

/** Global quality gate requirements schema. */
const GlobalRequirementsSchema = z.object({
  minQualityScoreNormalized: z.number().min(0).max(1).optional(),
  requireAnyOfRatingsPresent: z.array(z.enum(VALID_RATING_SOURCES)).optional(),
  minVotesAnyOf: z
    .object({
      sources: z.array(z.enum(VALID_VOTE_SOURCES)).min(1),
      min: z.number().int().min(0),
    })
    .optional(),
  appliesTo: z.array(z.enum(VALID_CONTEXTS)).optional(),
});

/** Context-specific display requirements schema. */
const ContextRequirementsSchema = z.object({
  requireReadableTitle: z.boolean().optional(),
  requireOverview: z.boolean().optional(),
  minOverviewChars: z.number().int().min(MIN_OVERVIEW_CHARS).max(MAX_OVERVIEW_CHARS).optional(),
});

/** Partial map of context to requirements. Rejects unknown context keys. */
const ContextRequirementsMapSchema = z
  .object({
    catalog: ContextRequirementsSchema.optional(),
    homepage: ContextRequirementsSchema.optional(),
    trending: ContextRequirementsSchema.optional(),
    now_playing: ContextRequirementsSchema.optional(),
    new_digital: ContextRequirementsSchema.optional(),
    search: ContextRequirementsSchema.optional(),
  })
  .strict();

/** Full policy configuration schema. */
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
  contextRequirements: ContextRequirementsMapSchema.optional(),
});

/**
 * Validates and normalizes policy configuration.
 *
 * Normalization: uppercase countries, lowercase languages, sort breakout rules by priority.
 *
 * @param policy - Raw policy configuration object
 * @returns Validated and normalized PolicyConfig
 * @throws {ZodError} When schema validation fails
 * @throws {PolicyValidationError} When business rules violated
 */
export function validatePolicyOrThrow(policy: unknown): PolicyConfig {
  // First, validate the structure
  const validated = PolicyConfigSchema.parse(policy);

  // Normalize the data
  // Cast to PolicyConfig since Zod validates the shape but returns looser types
  const normalized = {
    ...validated,
    // Uppercase country codes
    allowedCountries: validated.allowedCountries.map((c) => c.toUpperCase()),
    blockedCountries: validated.blockedCountries.map((c) => c.toUpperCase()),
    // Lowercase language codes
    allowedLanguages: validated.allowedLanguages.map((l) => l.toLowerCase()),
    blockedLanguages: validated.blockedLanguages.map((l) => l.toLowerCase()),
    // Sort breakout rules by priority (ascending - lower number = higher priority)
    breakoutRules: [...validated.breakoutRules].sort((a, b) => a.priority - b.priority),
  } as PolicyConfig;

  // Additional business logic validations
  validateBusinessRules(normalized);

  return normalized;
}

/**
 * Validates business rules beyond schema structure.
 *
 * @throws {PolicyValidationError} When business rules violated
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
 * Type guard for PolicyConfig.
 *
 * @param value - Value to check
 * @returns True if value is valid PolicyConfig
 */
export function isPolicyConfig(value: unknown): value is PolicyConfig {
  try {
    validatePolicyOrThrow(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Admin API client for catalog policies and evaluation runs.
 * Uses generated types from @ratingo/api-contract.
 */

import { apiGet, apiPost } from './client'
import type { components } from '@ratingo/api-contract'

// ============================================================================
// Types from API contract (generated)
// ============================================================================

/** Policy DTO from API contract. */
export type PolicyDto = components['schemas']['PolicyDto']

/** Blocked country mode enum from API contract. */
export type BlockedCountryMode = components['schemas']['PolicyConfigDto']['blockedCountryMode']

/** Eligibility mode enum from API contract. */
export type EligibilityMode = components['schemas']['PolicyConfigDto']['eligibilityMode']

/** Breakout rule requirements type. */
export interface BreakoutRuleRequirements {
  minImdbVotes?: number
  minTraktVotes?: number
  minQualityScoreNormalized?: number
  requireAnyOfProviders?: string[]
  requireAnyOfRatingsPresent?: ('imdb' | 'metacritic' | 'rt' | 'trakt')[]
}

/** Breakout rule type. */
export interface BreakoutRule {
  id: string
  name: string
  priority: number
  requirements: BreakoutRuleRequirements
}

/** Homepage config type. */
export interface HomepageConfig {
  minRelevanceScore: number
}

/** Create policy request type (manual, because generated types are broken). */
export interface CreatePolicyRequest {
  allowedCountries: string[]
  blockedCountries: string[]
  blockedCountryMode?: BlockedCountryMode
  allowedLanguages: string[]
  blockedLanguages: string[]
  globalProviders?: string[]
  breakoutRules?: BreakoutRule[]
  eligibilityMode?: EligibilityMode
  homepage?: { minRelevanceScore?: number }
}

/** Policy config type. */
export interface PolicyConfigDto {
  allowedCountries: string[]
  blockedCountries: string[]
  blockedCountryMode: BlockedCountryMode
  allowedLanguages: string[]
  blockedLanguages: string[]
  globalProviders: string[]
  breakoutRules: BreakoutRule[]
  eligibilityMode: EligibilityMode
  homepage: HomepageConfig
}

/** Policy detail DTO type. */
export interface PolicyDetailDto {
  id: string
  name: string
  version: string
  status: 'active' | 'inactive'
  config: PolicyConfigDto
  createdAt: string
  activatedAt?: string
}

/** Evaluation run DTO from API contract. */
export type EvaluationRunDto = components['schemas']['EvaluationRunDto']

/** Run status DTO with detailed progress from API contract. */
export type RunStatusDto = components['schemas']['RunStatusDto']

/** Prepare response DTO from API contract. */
export type PrepareResponseDto = components['schemas']['PrepareResponseDto']

/** Action response DTO from API contract. */
export type ActionResponseDto = components['schemas']['ActionResponseDto']

/** Diff report DTO from API contract. */
export type DiffReportDto = components['schemas']['DiffReportDto']

/** Progress statistics DTO from API contract. */
export type ProgressStatsDto = components['schemas']['ProgressStatsDto']

/** Create policy request DTO from API contract. */
export type CreatePolicyDto = components['schemas']['CreatePolicyDto']

/** Create policy response DTO from API contract. */
export type CreatePolicyResponseDto = components['schemas']['CreatePolicyResponseDto']

/** Policies list response DTO from API contract. */
export type PoliciesListDto = components['schemas']['PoliciesListDto']

/** Runs list response DTO from API contract. */
export type RunsListDto = components['schemas']['RunsListDto']

// ============================================================================
// Status constants and helpers
// ============================================================================

/** Terminal statuses where polling should stop. */
export const TERMINAL_STATUSES = ['prepared', 'failed', 'cancelled', 'promoted'] as const

/** Terminal status type. */
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number]

/** Non-terminal statuses where polling should continue. */
export const NON_TERMINAL_STATUSES = ['running'] as const

/** Non-terminal status type. */
export type NonTerminalStatus = (typeof NON_TERMINAL_STATUSES)[number]

/** All run status values. */
export type RunStatus = TerminalStatus | NonTerminalStatus

/** Policy status values. */
export type PolicyStatus = 'active' | 'inactive'

/**
 * Checks if a run status is terminal.
 * 
 * Terminal statuses indicate the run has finished and polling should stop.
 *
 * @param status - Run status to check
 * @returns True if status is terminal
 */
export function isTerminalStatus(status: string): status is TerminalStatus {
  return TERMINAL_STATUSES.includes(status as TerminalStatus)
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Admin API client for catalog policy management.
 * 
 * Provides methods for managing policies and evaluation runs through
 * the two-phase activation process (Prepare → Promote).
 */
export class AdminApiClient {
  // -------------------------------------------------------------------------
  // Policies
  // -------------------------------------------------------------------------

  /**
   * Gets all policies.
   *
   * @returns List of all policies
   */
  async getPolicies(): Promise<PolicyDto[]> {
    const response = await apiGet<PoliciesListDto>('admin/catalog-policies')
    return response.data
  }

  /**
   * Gets a single policy with full configuration.
   *
   * @param policyId - Policy ID
   * @returns Policy with full configuration
   */
  async getPolicyById(policyId: string): Promise<PolicyDetailDto> {
    return apiGet<PolicyDetailDto>(`admin/catalog-policies/${policyId}`)
  }

  /**
   * Creates a new policy.
   *
   * @param body - Policy configuration
   * @returns Created policy response with ID and version
   */
  async createPolicy(body: CreatePolicyRequest): Promise<CreatePolicyResponseDto> {
    return apiPost<CreatePolicyResponseDto>('admin/catalog-policies', body)
  }

  /**
   * Starts policy evaluation (prepare phase).
   * 
   * Creates an evaluation run to test policy changes without activating them.
   *
   * @param policyId - Policy ID to prepare
   * @param options - Optional batch size and concurrency settings
   * @returns Prepare response with run ID and status
   */
  async preparePolicy(
    policyId: string,
    options?: { batchSize?: number; concurrency?: number }
  ): Promise<PrepareResponseDto> {
    return apiPost<PrepareResponseDto>(`admin/catalog-policies/${policyId}/prepare`, options)
  }

  // -------------------------------------------------------------------------
  // Evaluation Runs
  // -------------------------------------------------------------------------

  /**
   * Gets all evaluation runs.
   * 
   * MVP: Fetches all runs with large limit for client-side filtering.
   * Avoids pagination + client-side filter trap.
   *
   * @param params - Optional limit parameter (default: 1000)
   * @returns List of all evaluation runs
   */
  async getRuns(params?: { limit?: number }): Promise<EvaluationRunDto[]> {
    const limit = params?.limit ?? 1000
    const response = await apiGet<RunsListDto>('admin/catalog-policies/runs', {
      searchParams: { limit },
    })
    return response.data
  }

  /**
   * Gets run status with detailed progress.
   *
   * @param runId - Run ID to check
   * @returns Run status with progress, counters, and readyToPromote flag
   */
  async getRunStatus(runId: string): Promise<RunStatusDto> {
    return apiGet<RunStatusDto>(`admin/catalog-policies/runs/${runId}`)
  }

  /**
   * Promotes a prepared run to activate the policy.
   * 
   * Verifies run is successful and meets thresholds, then atomically
   * activates the policy. Idempotent - safe to call multiple times.
   *
   * @param runId - Run ID to promote
   * @param options - Optional coverage threshold and max errors
   * @returns Action response with success status
   */
  async promoteRun(
    runId: string,
    options?: { coverageThreshold?: number; maxErrors?: number }
  ): Promise<ActionResponseDto> {
    return apiPost<ActionResponseDto>(`admin/catalog-policies/runs/${runId}/promote`, options)
  }

  /**
   * Cancels a running or prepared evaluation.
   * 
   * Idempotent - safe to call multiple times.
   *
   * @param runId - Run ID to cancel
   * @returns Action response with success status
   */
  async cancelRun(runId: string): Promise<ActionResponseDto> {
    return apiPost<ActionResponseDto>(`admin/catalog-policies/runs/${runId}/cancel`)
  }

  /**
   * Gets diff report for a prepared run.
   * 
   * Shows what will change when policy is promoted: regressions (items
   * leaving catalog) and improvements (items entering catalog).
   *
   * @param runId - Run ID to get diff for
   * @param sampleSize - Max items per category (default: 50)
   * @returns Diff report with counts and sample items
   */
  async getRunDiff(runId: string, sampleSize = 50): Promise<DiffReportDto> {
    return apiGet<DiffReportDto>(`admin/catalog-policies/runs/${runId}/diff`, {
      searchParams: { sampleSize },
    })
  }
}

/** Singleton admin API client instance. */
export const adminApi = new AdminApiClient()

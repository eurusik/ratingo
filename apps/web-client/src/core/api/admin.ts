/**
 * Admin API client for catalog policies and evaluation runs
 * Uses generated types from @ratingo/api-contract
 */

import { apiGet, apiPost } from './client'
import type { components } from '@ratingo/api-contract'

// ============================================================================
// Types from API contract (generated)
// ============================================================================
export type PrepareResponse = components['schemas']['PrepareResponseDto']
export type RunStatusResponse = components['schemas']['RunStatusDto']
export type ActionResponse = components['schemas']['ActionResponseDto']
export type DiffReport = components['schemas']['DiffReportDto']
export type ProgressStats = components['schemas']['ProgressStatsDto']

// ============================================================================
// Admin domain types
// ============================================================================

/** Run status values */
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'promoted'

/** Policy status values */
export type PolicyStatus = 'active' | 'inactive'

/** Progress statistics for evaluation runs */
export interface RunProgress {
  processed: number
  total: number
  eligible: number
  ineligible: number
  pending: number
  errors: number
}

/** Policy entity */
export interface Policy {
  id: string
  name: string
  version: string
  status: PolicyStatus
  description?: string
  updatedAt: string
}

/** Evaluation run entity */
export interface EvaluationRun {
  id: string
  policyId: string
  policyName: string
  status: RunStatus
  progress: RunProgress
  startedAt: string
  finishedAt?: string
  readyToPromote?: boolean
}

// ============================================================================
// API Client
// ============================================================================

export class AdminApiClient {
  // Policies
  async getPolicies(): Promise<Policy[]> {
    // TODO: Implement when API endpoint is available
    // For now, return mock data
    return [
      {
        id: 'content-filtering-v1',
        name: 'Content Filtering Policy',
        version: '1.0',
        status: 'active',
        description: 'Filters content based on quality and popularity thresholds',
        updatedAt: '2024-12-20T10:00:00Z'
      },
      {
        id: 'rating-validation-v1',
        name: 'Rating Validation Policy',
        version: '1.0',
        status: 'inactive',
        description: 'Validates content ratings from multiple sources',
        updatedAt: '2024-12-19T15:30:00Z'
      },
      {
        id: 'user-moderation-v1',
        name: 'User Moderation Policy',
        version: '1.0',
        status: 'inactive',
        description: 'Moderates user-generated content and reviews',
        updatedAt: '2024-12-18T09:15:00Z'
      }
    ]
  }

  async preparePolicy(policyId: string, options?: { batchSize?: number; concurrency?: number }): Promise<PrepareResponse> {
    return apiPost<PrepareResponse>(`admin/catalog-policies/${policyId}/prepare`, options)
  }

  // Evaluation Runs
  async getRuns(): Promise<EvaluationRun[]> {
    // TODO: Implement when API endpoint is available
    // For now, return mock data based on real API structure
    return [
      {
        id: 'run-001',
        policyId: 'content-filtering-v1',
        policyName: 'Content Filtering Policy',
        status: 'success',
        progress: {
          processed: 1000,
          total: 1000,
          eligible: 850,
          ineligible: 100,
          pending: 0,
          errors: 50
        },
        startedAt: '2024-12-20T10:30:00Z',
        finishedAt: '2024-12-20T11:15:00Z',
        readyToPromote: true
      },
      {
        id: 'run-002',
        policyId: 'rating-validation-v1',
        policyName: 'Rating Validation Policy',
        status: 'running',
        progress: {
          processed: 750,
          total: 1200,
          eligible: 600,
          ineligible: 100,
          pending: 450,
          errors: 50
        },
        startedAt: '2024-12-20T14:00:00Z',
        readyToPromote: false
      },
      {
        id: 'run-003',
        policyId: 'user-moderation-v1',
        policyName: 'User Moderation Policy',
        status: 'failed',
        progress: {
          processed: 300,
          total: 800,
          eligible: 200,
          ineligible: 50,
          pending: 500,
          errors: 50
        },
        startedAt: '2024-12-19T16:30:00Z',
        finishedAt: '2024-12-19T16:45:00Z',
        readyToPromote: false
      },
      {
        id: 'run-004',
        policyId: 'content-filtering-v1',
        policyName: 'Content Filtering Policy',
        status: 'promoted',
        progress: {
          processed: 2000,
          total: 2000,
          eligible: 1800,
          ineligible: 150,
          pending: 0,
          errors: 50
        },
        startedAt: '2024-12-18T09:00:00Z',
        finishedAt: '2024-12-18T10:30:00Z',
        readyToPromote: false
      }
    ]
  }

  async getRunStatus(runId: string): Promise<RunStatusResponse> {
    return apiGet<RunStatusResponse>(`admin/catalog-policies/runs/${runId}`)
  }

  async promoteRun(runId: string, options?: { coverageThreshold?: number; maxErrors?: number }): Promise<ActionResponse> {
    return apiPost<ActionResponse>(`admin/catalog-policies/runs/${runId}/promote`, options)
  }

  async cancelRun(runId: string): Promise<ActionResponse> {
    return apiPost<ActionResponse>(`admin/catalog-policies/runs/${runId}/cancel`)
  }

  async getRunDiff(runId: string, sampleSize = 50): Promise<DiffReport> {
    return apiGet<DiffReport>(`admin/catalog-policies/runs/${runId}/diff`, {
      searchParams: { sampleSize }
    })
  }
}

// Export singleton instance
export const adminApi = new AdminApiClient()
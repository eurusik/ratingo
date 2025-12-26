/**
 * TanStack Query hooks for admin operations.
 * 
 * Provides React hooks for fetching and mutating catalog policies and
 * evaluation runs with automatic caching and invalidation.
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useMemo } from 'react'
import { adminApi, isTerminalStatus } from '../api/admin'
import { queryKeys } from './keys'

// ============================================================================
// Policies queries
// ============================================================================

/**
 * Fetches all policies.
 *
 * @param enabled - Whether query is enabled (default: true)
 * @returns Query result with policies list
 */
export function usePolicies(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.policies.all,
    queryFn: () => adminApi.getPolicies(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetches a single policy with full configuration.
 *
 * @param policyId - Policy ID to fetch
 * @param enabled - Whether query is enabled (default: true)
 * @returns Query result with policy details including config
 */
export function usePolicyDetail(policyId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.policies.detail(policyId),
    queryFn: () => adminApi.getPolicyById(policyId),
    enabled: enabled && !!policyId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// ============================================================================
// Evaluation runs queries
// ============================================================================

/**
 * Fetches ALL runs (MVP approach).
 * 
 * Uses large limit to avoid pagination + client-side filter trap.
 *
 * @param enabled - Whether query is enabled (default: true)
 * @returns Query result with all runs
 */
export function useRuns(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.runs.all,
    queryFn: () => adminApi.getRuns({ limit: 1000 }), // Large limit to get all runs
    enabled,
    staleTime: 1000 * 30, // 30 seconds - runs change more frequently
  })
}

/**
 * Fetches runs filtered by status (client-side).
 * 
 * MVP: Filters after fetching all runs to avoid pagination issues.
 *
 * @param statusFilter - Status to filter by (optional, 'all' for no filter)
 * @returns Query result with filtered runs
 */
export function useFilteredRuns(statusFilter?: string) {
  const query = useRuns()

  const filteredData = useMemo(() => {
    if (!query.data || !statusFilter || statusFilter === 'all') {
      return query.data
    }
    return query.data.filter((run) => run.status === statusFilter)
  }, [query.data, statusFilter])

  return { ...query, data: filteredData }
}

/**
 * Fetches runs filtered by policy (client-side).
 * 
 * MVP: Filters after fetching all runs to avoid pagination issues.
 *
 * @param policyId - Policy ID to filter by
 * @returns Query result with filtered runs
 */
export function useRunsByPolicy(policyId: string) {
  const query = useRuns()

  const filteredData = useMemo(() => {
    if (!query.data) return undefined
    return query.data.filter((run) => run.policyId === policyId)
  }, [query.data, policyId])

  return { ...query, data: filteredData }
}

/**
 * Fetches run status with visibility-based polling.
 * 
 * Automatically pauses polling when tab is hidden and stops when
 * run reaches terminal status (prepared, failed, cancelled, promoted).
 *
 * @param options - Query options
 * @param options.runId - Run ID to fetch status for
 * @param options.autoRefresh - Enable auto-refresh polling (default: true)
 * @param options.refreshInterval - Polling interval in ms (default: 5000)
 * @param options.enabled - Whether query is enabled (default: true)
 * @returns Query result with run status
 */
export function useRunStatus(options: {
  runId: string
  autoRefresh?: boolean
  refreshInterval?: number
  enabled?: boolean
}) {
  const { runId, autoRefresh = true, refreshInterval = 5000, enabled = true } = options
  const isVisibleRef = useRef(true)

  // Track document visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return useQuery({
    queryKey: queryKeys.admin.runs.status(runId),
    queryFn: () => adminApi.getRunStatus(runId),
    enabled,
    refetchInterval: (query) => {
      // Stop polling if tab hidden
      if (!isVisibleRef.current) return false
      // Stop polling if terminal status
      const status = query.state.data?.status
      if (status && isTerminalStatus(status)) return false
      // Continue polling
      return autoRefresh ? refreshInterval : false
    },
    staleTime: 1000 * 5, // 5 seconds
  })
}

/**
 * Fetches diff report for a prepared run.
 *
 * @param options - Query options
 * @param options.runId - Run ID to get diff for
 * @param options.sampleSize - Max items per category (default: 50)
 * @param options.enabled - Whether query is enabled (default: true)
 * @returns Query result with diff report
 */
export function useRunDiff(options: {
  runId: string
  sampleSize?: number
  enabled?: boolean
}) {
  const { runId, sampleSize = 50, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.admin.runs.diff(runId, sampleSize),
    queryFn: () => adminApi.getRunDiff(runId, sampleSize),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes - diff reports don't change often
  })
}

// ============================================================================
// Mutations with correct cache invalidation (per R16)
// ============================================================================

/**
 * Mutation hook for preparing a policy.
 * 
 * Starts evaluation run to test policy changes. Invalidates runs and
 * policies cache on success (R16.1).
 *
 * @returns Mutation object
 */
export function usePreparePolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: {
      policyId: string
      options?: { batchSize?: number; concurrency?: number }
    }) => adminApi.preparePolicy(params.policyId, params.options),
    onSuccess: (_, variables) => {
      // R16.1: Invalidate runs.all, policies.all, policies.detail(policyId)
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.policies.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.policies.detail(variables.policyId),
      })
    },
  })
}

/**
 * Mutation hook for promoting a run.
 * 
 * Activates prepared policy. Invalidates runs and policies cache
 * on success (R16.2). Idempotent - safe to call multiple times.
 *
 * @returns Mutation object
 */
export function usePromoteRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: {
      runId: string
      policyId: string
      options?: { coverageThreshold?: number; maxErrors?: number }
    }) => adminApi.promoteRun(params.runId, params.options),
    onSuccess: (_, variables) => {
      // R16.2: Invalidate runs.all, runs.status(runId), policies.all, policies.detail(policyId)
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.status(variables.runId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.policies.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.policies.detail(variables.policyId),
      })
    },
  })
}

/**
 * Mutation hook for cancelling a run.
 * 
 * Cancels running or prepared evaluation. Invalidates runs cache
 * on success (R16.3). Idempotent - safe to call multiple times.
 *
 * @returns Mutation object
 */
export function useCancelRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (runId: string) => adminApi.cancelRun(runId),
    onSuccess: (_, runId) => {
      // R16.3: Invalidate runs.all, runs.status(runId)
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.status(runId) })
    },
  })
}

/**
 * Mutation hook for creating a policy.
 * 
 * Creates new policy configuration. Invalidates policies cache
 * on success (R16.4).
 *
 * @returns Mutation object
 */
export function useCreatePolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: Parameters<typeof adminApi.createPolicy>[0]) =>
      adminApi.createPolicy(body),
    onSuccess: () => {
      // R16.4: Invalidate policies.all
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.policies.all })
    },
  })
}

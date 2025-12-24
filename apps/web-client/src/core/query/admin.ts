/**
 * TanStack Query hooks for admin operations
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api/admin'
import { queryKeys } from './keys'

// Policies queries
export function usePolicies(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.policies.all,
    queryFn: () => adminApi.getPolicies(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Evaluation runs queries
export function useRuns(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.runs.all,
    queryFn: () => adminApi.getRuns(),
    enabled,
    staleTime: 1000 * 30, // 30 seconds - runs change more frequently
  })
}

// Run status query with auto-refresh
export function useRunStatus(options: {
  runId: string
  autoRefresh?: boolean
  refreshInterval?: number
  enabled?: boolean
}) {
  const { runId, autoRefresh = false, refreshInterval = 5000, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.admin.runs.status(runId),
    queryFn: () => adminApi.getRunStatus(runId),
    enabled,
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 1000 * 30, // 30 seconds
  })
}

// Run diff query
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

// Mutations
export function usePreparePolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { policyId: string; options?: { batchSize?: number; concurrency?: number } }) =>
      adminApi.preparePolicy(params.policyId, params.options),
    onSuccess: () => {
      // Invalidate runs to show new run
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.all })
    },
  })
}

export function usePromoteRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { runId: string; options?: { coverageThreshold?: number; maxErrors?: number } }) =>
      adminApi.promoteRun(params.runId, params.options),
    onSuccess: (_, variables) => {
      // Invalidate both runs and specific run status
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.status(variables.runId) })
    },
  })
}

export function useCancelRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (runId: string) => adminApi.cancelRun(runId),
    onSuccess: (_, runId) => {
      // Invalidate both runs and specific run status
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runs.status(runId) })
    },
  })
}
/**
 * RunStatusCard - Displays detailed run status information
 */

'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Badge } from '../../../shared/ui/badge'
import { Progress } from '../../../shared/ui/progress'
import { Button } from '../../../shared/ui/button'
import { RefreshCw, Play, X } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { useTranslation } from '../../../shared/i18n'
import { useRunStatus, usePromoteRun, useCancelRun } from '../../../core/query'
import { toast } from 'sonner'

interface RunStatusCardProps {
  runId: string
  autoRefresh?: boolean
  onPromote?: () => void
  onCancel?: () => void
}

export function RunStatusCard({ 
  runId, 
  autoRefresh = true,
  onPromote,
  onCancel 
}: RunStatusCardProps) {
  const { dict } = useTranslation()
  const { data: runStatus, isLoading, error, refetch } = useRunStatus({ 
    runId, 
    autoRefresh 
  })

  const promoteRunMutation = usePromoteRun()
  const cancelRunMutation = useCancelRun()

  const handlePromote = async () => {
    if (!runStatus) return

    try {
      const result = await promoteRunMutation.mutateAsync({ 
        runId,
        policyId: runStatus.targetPolicyId 
      })
      
      if (result.success) {
        toast.success(result.message || dict.admin.runDetail.toast.promoteSuccess)
        onPromote?.()
      } else {
        toast.error(result.error || dict.admin.runDetail.toast.promoteFailed)
      }
    } catch (error) {
      console.error('Failed to promote run:', error)
      toast.error(dict.admin.runDetail.toast.promoteFailed)
    }
  }

  const handleCancel = async () => {
    if (!runStatus) return

    try {
      const result = await cancelRunMutation.mutateAsync(runId)
      
      if (result.success) {
        toast.success(result.message || dict.admin.runDetail.toast.cancelSuccess)
        onCancel?.()
      } else {
        toast.error(result.error || dict.admin.runDetail.toast.cancelFailed)
      }
    } catch (error) {
      console.error('Failed to cancel run:', error)
      toast.error(dict.admin.runDetail.toast.cancelFailed)
    }
  }

  const handleRefresh = () => {
    refetch()
  }

  if (isLoading && !runStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error.message}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {dict.admin.common.tryAgain}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!runStatus) return null

  const progress = runStatus.progress
  const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg">Run {runStatus.id}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Policy: {runStatus.targetPolicyId} (v{runStatus.targetPolicyVersion})
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <StatusBadge status={runStatus.status} />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{dict.admin.runDetail.progress.title}</span>
            <span className="text-sm text-muted-foreground">
              {progress.processed}/{progress.total} ({percentage}% {dict.admin.runDetail.progress.complete})
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              {progress.eligible} {dict.admin.runs.progress.eligible}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {progress.ineligible} {dict.admin.runs.progress.ineligible}
            </Badge>
            {progress.pending > 0 && (
              <Badge variant="outline" className="text-xs">
                {progress.pending} {dict.admin.runs.progress.pending}
              </Badge>
            )}
            {progress.errors > 0 && (
              <Badge variant="destructive" className="text-xs">
                {progress.errors} {dict.admin.runs.progress.errors}
              </Badge>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Started:</span>
            <div>{new Date(runStatus.startedAt).toLocaleString()}</div>
          </div>
          {runStatus.finishedAt && (
            <div>
              <span className="text-muted-foreground">Finished:</span>
              <div>{new Date(runStatus.finishedAt).toLocaleString()}</div>
            </div>
          )}
        </div>

        {/* Blocking reasons */}
        {runStatus.blockingReasons.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-destructive">
              Cannot promote
            </span>
            <ul className="text-sm text-muted-foreground space-y-1">
              {runStatus.blockingReasons.map((reason, index) => (
                <li key={index}>• {String(reason)}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-4 border-t">
          {runStatus.readyToPromote && (
            <Button
              onClick={handlePromote}
              disabled={promoteRunMutation.isPending}
              className="flex-1"
            >
              {promoteRunMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {dict.admin.runDetail.actions.promote}
            </Button>
          )}
          
          {runStatus.status === 'running' && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelRunMutation.isPending}
              className="flex-1"
            >
              {cancelRunMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              {dict.admin.runDetail.actions.cancel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
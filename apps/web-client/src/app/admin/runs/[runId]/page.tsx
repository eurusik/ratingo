"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { 
  StatusBadge, 
  ProgressWithStats, 
  ConfirmActionDialog
} from '@/modules/admin'
import { toast } from 'sonner'
import { useRunStatus, useRunDiff, usePromoteRun, useCancelRun } from '@/core/query/admin'
import { useTranslation } from '@/shared/i18n'
import { RUN_STATUS } from '@/modules/admin/types'

/**
 * Run detail page.
 * 
 * Shows run status, progress, diff report, and error samples.
 */
export default function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const resolvedParams = React.use(params)
  const runId = resolvedParams.runId
  const { dict } = useTranslation()
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type?: 'promote' | 'cancel'
  }>({ open: false })
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  // Fetch run status with polling
  const { data: run, isLoading, error } = useRunStatus({
    runId: runId,
    autoRefresh: true,
    refreshInterval: 5000,
  })

  // Fetch diff only when status is 'prepared'
  const { data: diffReport } = useRunDiff({
    runId: runId,
    sampleSize: 50,
    enabled: run?.status === RUN_STATUS.PREPARED,
  })

  // Mutations
  const promoteRunMutation = usePromoteRun()
  const cancelRunMutation = useCancelRun()

  const handlePromote = async () => {
    if (!run) return

    try {
      await promoteRunMutation.mutateAsync({
        runId: runId,
        policyId: run.targetPolicyId,
      })
      toast.success(dict.admin.runDetail.toast.promoteSuccess)
      setConfirmDialog({ open: false })
    } catch (error) {
      console.error('Failed to promote run:', error)
      toast.error(dict.admin.runDetail.toast.promoteFailed)
    }
  }

  const handleCancel = async () => {
    try {
      await cancelRunMutation.mutateAsync(runId)
      toast.success(dict.admin.runDetail.toast.cancelSuccess)
      setConfirmDialog({ open: false })
    } catch (error) {
      console.error('Failed to cancel run:', error)
      toast.error(dict.admin.runDetail.toast.cancelFailed)
    }
  }

  const toggleErrorExpansion = (errorId: string) => {
    const newExpanded = new Set(expandedErrors)
    if (newExpanded.has(errorId)) {
      newExpanded.delete(errorId)
    } else {
      newExpanded.add(errorId)
    }
    setExpandedErrors(newExpanded)
  }

  // Maps blocking reason codes to human-readable messages
  const getBlockingReasonMessages = (reasons: unknown[][] | null | undefined): string[] => {
    if (!reasons || reasons.length === 0) {
      return [dict.admin.runDetail.blockingReasons.default]
    }
    // Flatten and convert to strings
    const codes = reasons.flat().filter((r): r is string => typeof r === 'string')
    return codes.map(code => {
      const key = code as keyof typeof dict.admin.runDetail.blockingReasons
      return dict.admin.runDetail.blockingReasons[key] || code
    })
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">{dict.admin.common.loading}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">
              {error?.message || dict.admin.common.error}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isMutating = promoteRunMutation.isPending || cancelRunMutation.isPending
  const blockingMessages = getBlockingReasonMessages(run.blockingReasons)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Run Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                {dict.admin.runDetail.title} {run.id}
                <StatusBadge status={run.status} />
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {dict.admin.runDetail.policy}: {run.targetPolicyId} • {dict.admin.runDetail.started}: {new Date(run.startedAt).toLocaleString('uk-UA')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {run.status === RUN_STATUS.RUNNING && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDialog({ open: true, type: 'cancel' })}
                  disabled={isMutating}
                >
                  {dict.admin.runDetail.actions.cancel}
                </Button>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        disabled={!run.readyToPromote || isMutating}
                        onClick={() => setConfirmDialog({ open: true, type: 'promote' })}
                      >
                        {dict.admin.runDetail.actions.promote}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!run.readyToPromote && (
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-medium">{dict.admin.runDetail.blockingReasons.title}</p>
                        {blockingMessages.map((message, index) => (
                          <p key={index} className="text-sm">• {message}</p>
                        ))}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Card */}
      <ProgressWithStats stats={run.progress} />

      {/* Tabs */}
      <Tabs defaultValue="diff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diff" disabled={run.status !== RUN_STATUS.PREPARED}>
            {dict.admin.runDetail.tabs.diff}
            {run.status !== RUN_STATUS.PREPARED && (
              <span className="ml-2 text-xs text-muted-foreground">({dict.admin.runDetail.diff.notAvailable})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="errors" disabled={run.progress.errors === 0}>
            {dict.admin.runDetail.tabs.errors}
            {run.progress.errors > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 text-xs">
                {run.progress.errors}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diff" className="space-y-4">
          {run.status !== RUN_STATUS.PREPARED ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  {dict.admin.runDetail.diff.notAvailable}
                </div>
              </CardContent>
            </Card>
          ) : diffReport ? (
            <Card>
              <CardHeader>
                <CardTitle>{dict.admin.runDetail.diff.title}</CardTitle>
                <div className="flex space-x-4 text-sm text-muted-foreground">
                  <span className="flex items-center">
                    <XCircle className="h-4 w-4 text-red-600 mr-1" />
                    {diffReport.counts.regressions} {dict.admin.runDetail.diff.regressions}
                  </span>
                  <span className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                    {diffReport.counts.improvements} {dict.admin.runDetail.diff.improvements}
                  </span>
                  <span className="flex items-center">
                    {dict.admin.runDetail.diff.netChange}: {diffReport.counts.netChange > 0 ? '+' : ''}{diffReport.counts.netChange}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {diffReport.topRegressions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 text-red-600">{dict.admin.runDetail.diff.topRegressions}</h3>
                    <div className="space-y-2">
                      {diffReport.topRegressions.map((item, idx) => (
                        <div key={idx} className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/20">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-sm text-muted-foreground">{dict.admin.runDetail.diff.mediaId}: {item.mediaItemId}</div>
                          <div className="text-sm">{dict.admin.runDetail.diff.statusChange}: {item.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {diffReport.topImprovements.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 text-green-600">{dict.admin.runDetail.diff.topImprovements}</h3>
                    <div className="space-y-2">
                      {diffReport.topImprovements.map((item, idx) => (
                        <div key={idx} className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-sm text-muted-foreground">{dict.admin.runDetail.diff.mediaId}: {item.mediaItemId}</div>
                          <div className="text-sm">{dict.admin.runDetail.diff.statusChange}: {item.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  {dict.admin.common.loading}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{dict.admin.runDetail.errors.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {run.progress.errors} {dict.admin.runDetail.errors.found}
              </p>
            </CardHeader>
            <CardContent>
              {!run.errorSample || run.errorSample.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {dict.admin.common.noData}
                </div>
              ) : (
                <div className="space-y-4">
                  {run.errorSample.map((error, idx) => (
                    <CollapsiblePrimitive.Root key={idx}>
                      <CollapsiblePrimitive.Trigger
                        className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50"
                        onClick={() => toggleErrorExpansion(String(idx))}
                      >
                        <div className="flex items-center space-x-3">
                          {expandedErrors.has(String(idx)) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div className="text-left">
                            <div className="font-medium">{error.error}</div>
                            <div className="text-sm text-muted-foreground">
                              {dict.admin.runDetail.diff.mediaId}: {error.mediaItemId}
                            </div>
                          </div>
                        </div>
                      </CollapsiblePrimitive.Trigger>
                      <CollapsiblePrimitive.Content className="px-4 pb-4">
                        <div className="space-y-4 mt-4">
                          <div className="text-sm">
                            <div><strong>{dict.admin.runDetail.diff.mediaId}:</strong> {error.mediaItemId}</div>
                            <div><strong>Timestamp:</strong> {error.timestamp}</div>
                          </div>
                          {error.stack && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base">{dict.admin.runDetail.errors.stackTrace}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto whitespace-pre-wrap">
                                  {error.stack}
                                </pre>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </CollapsiblePrimitive.Content>
                    </CollapsiblePrimitive.Root>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialogs */}
      <ConfirmActionDialog
        open={confirmDialog.open && confirmDialog.type === 'promote'}
        onOpenChange={(open) => setConfirmDialog({ open })}
        title={dict.admin.runDetail.confirmPromote.title}
        description={dict.admin.runDetail.confirmPromote.description
          .replace('{policyName}', run.targetPolicyId)
          .replace('{runId}', run.id)}
        confirmText="PROMOTE"
        requireTyping={true}
        onConfirm={handlePromote}
        variant="default"
      />

      <ConfirmActionDialog
        open={confirmDialog.open && confirmDialog.type === 'cancel'}
        onOpenChange={(open) => setConfirmDialog({ open })}
        title={dict.admin.runDetail.confirmCancel.title}
        description={dict.admin.runDetail.confirmCancel.description
          .replace('{policyName}', run.targetPolicyId)
          .replace('{runId}', run.id)}
        confirmText={dict.admin.runDetail.confirmCancel.confirm}
        onConfirm={handleCancel}
        variant="destructive"
      />
    </div>
  )
}

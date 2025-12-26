"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { 
  StatusBadge, 
  ProgressWithStats, 
  ConfirmActionDialog,
  JsonViewer,
  DataTable 
} from '@/modules/admin'
import { DataTableColumnDef } from '@/modules/admin/types'
import { toast } from 'sonner'
import { useRunStatus, useRunDiff, usePromoteRun, useCancelRun } from '@/core/query/admin'
import { type RunStatusDto, type DiffReportDto } from '@/core/api/admin'

// Blocking reason messages mapping
const BLOCKING_REASON_MESSAGES: Record<string, string> = {
  RUN_NOT_SUCCESS: 'Run ще не завершився',
  COVERAGE_NOT_MET: 'Coverage < 100%',
  ERRORS_EXCEEDED: 'Є помилки (errors > 0)',
  ALREADY_PROMOTED: 'Run вже промоутнутий',
}

export default function RunDetailPage({ params }: { params: { runId: string } }) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type?: 'promote' | 'cancel'
  }>({ open: false })
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  // Fetch run status with polling
  const { data: run, isLoading, error } = useRunStatus({
    runId: params.runId,
    autoRefresh: true,
    refreshInterval: 5000,
  })

  // Fetch diff only when status is 'prepared'
  const { data: diffReport } = useRunDiff({
    runId: params.runId,
    sampleSize: 50,
    enabled: run?.status === 'prepared',
  })

  // Mutations
  const promoteRunMutation = usePromoteRun()
  const cancelRunMutation = useCancelRun()

  const handlePromote = async () => {
    if (!run) return

    try {
      await promoteRunMutation.mutateAsync({
        runId: params.runId,
        policyId: run.targetPolicyId,
      })
      toast.success('Run promoted successfully')
      setConfirmDialog({ open: false })
    } catch (error) {
      console.error('Failed to promote run:', error)
      toast.error('Failed to promote run')
    }
  }

  const handleCancel = async () => {
    try {
      await cancelRunMutation.mutateAsync(params.runId)
      toast.success('Run cancelled successfully')
      setConfirmDialog({ open: false })
    } catch (error) {
      console.error('Failed to cancel run:', error)
      toast.error('Failed to cancel run')
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

  // Map blocking reason codes to human messages
  const getBlockingReasonMessages = (reasons: unknown[][] | null | undefined): string[] => {
    if (!reasons || reasons.length === 0) {
      return ['Run is not ready for promotion']
    }
    // Flatten and convert to strings
    const codes = reasons.flat().filter((r): r is string => typeof r === 'string')
    return codes.map(code => BLOCKING_REASON_MESSAGES[code] || code)
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading run details...</div>
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
              {error?.message || 'Run not found'}
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
                Run {run.id}
                <StatusBadge status={run.status} />
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Policy: {run.targetPolicyId} • Started: {new Date(run.startedAt).toLocaleString('uk-UA')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {run.status === 'running' && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDialog({ open: true, type: 'cancel' })}
                  disabled={isMutating}
                >
                  Cancel
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
                        Promote
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!run.readyToPromote && (
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-medium">Cannot promote due to:</p>
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
          <TabsTrigger value="diff" disabled={run.status !== 'prepared'}>
            Diff
            {run.status !== 'prepared' && (
              <span className="ml-2 text-xs text-muted-foreground">(available when prepared)</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="errors" disabled={run.progress.errors === 0}>
            Errors
            {run.progress.errors > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 text-xs">
                {run.progress.errors}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diff" className="space-y-4">
          {diffReport ? (
            <Card>
              <CardHeader>
                <CardTitle>Changes Summary</CardTitle>
                <div className="flex space-x-4 text-sm text-muted-foreground">
                  <span className="flex items-center">
                    <XCircle className="h-4 w-4 text-red-600 mr-1" />
                    {diffReport.counts.regressions} regressions
                  </span>
                  <span className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                    {diffReport.counts.improvements} improvements
                  </span>
                  <span className="flex items-center">
                    Net change: {diffReport.counts.netChange > 0 ? '+' : ''}{diffReport.counts.netChange}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {diffReport.topRegressions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 text-red-600">Top Regressions (leaving catalog)</h3>
                    <div className="space-y-2">
                      {diffReport.topRegressions.map((item, idx) => (
                        <div key={idx} className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/20">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-sm text-muted-foreground">ID: {item.mediaItemId}</div>
                          <div className="text-sm">{item.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {diffReport.topImprovements.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 text-green-600">Top Improvements (entering catalog)</h3>
                    <div className="space-y-2">
                      {diffReport.topImprovements.map((item, idx) => (
                        <div key={idx} className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-sm text-muted-foreground">ID: {item.mediaItemId}</div>
                          <div className="text-sm">{item.reason}</div>
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
                  Loading diff report...
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Samples</CardTitle>
              <p className="text-sm text-muted-foreground">
                {run.progress.errors} errors found during evaluation
              </p>
            </CardHeader>
            <CardContent>
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
                            Media ID: {error.mediaItemId}
                          </div>
                        </div>
                      </div>
                    </CollapsiblePrimitive.Trigger>
                    <CollapsiblePrimitive.Content className="px-4 pb-4">
                      <div className="space-y-4 mt-4">
                        <div className="text-sm">
                          <div><strong>Media ID:</strong> {error.mediaItemId}</div>
                          <div><strong>Timestamp:</strong> {error.timestamp}</div>
                        </div>
                        {error.stack && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Stack Trace</CardTitle>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialogs */}
      <ConfirmActionDialog
        open={confirmDialog.open && confirmDialog.type === 'promote'}
        onOpenChange={(open) => setConfirmDialog({ open })}
        title="Promote Run"
        description="Are you sure you want to promote this run? This will apply all changes to the production environment."
        confirmText="PROMOTE"
        requireTyping={true}
        onConfirm={handlePromote}
        variant="default"
      />

      <ConfirmActionDialog
        open={confirmDialog.open && confirmDialog.type === 'cancel'}
        onOpenChange={(open) => setConfirmDialog({ open })}
        title="Cancel Run"
        description="Are you sure you want to cancel this running evaluation? This action cannot be undone."
        confirmText="Cancel Run"
        onConfirm={handleCancel}
        variant="destructive"
      />
    </div>
  )
}

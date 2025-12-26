"use client"

import React, { useState } from 'react'
import { Card, CardContent } from '@/shared/ui/card'
import { Badge } from '@/shared/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { 
  ProgressWithStats, 
  ConfirmActionDialog,
  RunHeader,
  RunDiffTab,
  RunErrorsTab,
} from '@/modules/admin'
import { RUN_STATUS } from '@/modules/admin/types'
import { toast } from 'sonner'
import { useRunStatus, useRunDiff, usePromoteRun, useCancelRun } from '@/core/query/admin'
import { useTranslation } from '@/shared/i18n'

export default function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const resolvedParams = React.use(params)
  const runId = resolvedParams.runId
  const { dict } = useTranslation()
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type?: 'promote' | 'cancel'
  }>({ open: false })

  const { data: run, isLoading, error } = useRunStatus({
    runId,
    autoRefresh: true,
    refreshInterval: 5000,
  })

  const { data: diffReport, isLoading: diffLoading } = useRunDiff({
    runId,
    sampleSize: 50,
    enabled: run?.status === RUN_STATUS.PREPARED,
  })

  const promoteRunMutation = usePromoteRun()
  const cancelRunMutation = useCancelRun()

  const handlePromote = async () => {
    if (!run) return
    try {
      await promoteRunMutation.mutateAsync({ runId, policyId: run.targetPolicyId })
      toast.success(dict.admin.runDetail.toast.promoteSuccess)
      setConfirmDialog({ open: false })
    } catch {
      toast.error(dict.admin.runDetail.toast.promoteFailed)
    }
  }

  const handleCancel = async () => {
    try {
      await cancelRunMutation.mutateAsync(runId)
      toast.success(dict.admin.runDetail.toast.cancelSuccess)
      setConfirmDialog({ open: false })
    } catch {
      toast.error(dict.admin.runDetail.toast.cancelFailed)
    }
  }

  const getBlockingReasonMessages = (reasons: unknown[][] | null | undefined): string[] => {
    if (!reasons || reasons.length === 0) {
      return [dict.admin.runDetail.blockingReasons.default]
    }
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <RunHeader
        id={run.id}
        status={run.status}
        targetPolicyId={run.targetPolicyId}
        startedAt={run.startedAt}
        readyToPromote={run.readyToPromote}
        blockingMessages={getBlockingReasonMessages(run.blockingReasons)}
        isMutating={isMutating}
        onPromote={() => setConfirmDialog({ open: true, type: 'promote' })}
        onCancel={() => setConfirmDialog({ open: true, type: 'cancel' })}
        labels={dict.admin.runDetail.header}
      />

      <ProgressWithStats stats={run.progress} />

      <Tabs defaultValue="diff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diff" disabled={run.status !== RUN_STATUS.PREPARED}>
            {dict.admin.runDetail.tabs.diff}
            {run.status !== RUN_STATUS.PREPARED && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({dict.admin.runDetail.diff.notAvailable})
              </span>
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
          ) : (
            <RunDiffTab
              diffReport={diffReport}
              isLoading={diffLoading}
              labels={dict.admin.runDetail.diffTab}
            />
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <RunErrorsTab
            errors={run.errorSample || []}
            totalErrors={run.progress.errors}
            labels={dict.admin.runDetail.errorsTab}
          />
        </TabsContent>
      </Tabs>

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

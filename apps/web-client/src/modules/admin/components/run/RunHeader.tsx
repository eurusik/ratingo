"use client"

import { Card, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { StatusBadge } from '@/modules/admin'
import { RUN_STATUS } from '@/modules/admin/types'

interface RunHeaderProps {
  id: string
  status: string
  targetPolicyId: string
  startedAt: string | Date
  readyToPromote: boolean
  blockingMessages: string[]
  isMutating: boolean
  onPromote: () => void
  onCancel: () => void
  labels: {
    title: string
    policy: string
    started: string
    promote: string
    cancel: string
    blockingReasonsTitle: string
  }
}

/**
 * Displays run header with status and action buttons.
 * 
 * Shows run ID, status badge, policy info, timestamps,
 * and promote/cancel buttons with blocking reasons tooltip.
 *
 * @param id - Run ID
 * @param status - Run status
 * @param targetPolicyId - Target policy ID
 * @param startedAt - Run start timestamp
 * @param readyToPromote - Whether run can be promoted
 * @param blockingMessages - Reasons why promotion is blocked
 * @param isMutating - Whether mutation is in progress
 * @param onPromote - Callback for promote action
 * @param onCancel - Callback for cancel action
 * @param labels - Localized labels
 */
export function RunHeader({
  id,
  status,
  targetPolicyId,
  startedAt,
  readyToPromote,
  blockingMessages,
  isMutating,
  onPromote,
  onCancel,
  labels,
}: RunHeaderProps) {
  const startedDate = new Date(startedAt).toLocaleString('uk-UA')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              {labels.title} {id}
              <StatusBadge status={status} />
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {labels.policy}: {targetPolicyId} • {labels.started}: {startedDate}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {status === RUN_STATUS.RUNNING && (
              <Button variant="destructive" onClick={onCancel} disabled={isMutating}>
                {labels.cancel}
              </Button>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button disabled={!readyToPromote || isMutating} onClick={onPromote}>
                      {labels.promote}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!readyToPromote && (
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-medium">{labels.blockingReasonsTitle}</p>
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
  )
}

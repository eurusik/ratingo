"use client"

import { Card, CardHeader, CardTitle } from '@/shared/ui/card'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Loader2, Play } from 'lucide-react'
import { POLICY_STATUS } from '@/modules/admin/types'

interface PolicyHeaderProps {
  name: string
  version: string
  status: string
  lastUpdated: Date | string
  onPrepare: () => void
  isPreparing: boolean
  labels: {
    active: string
    inactive: string
    lastUpdated: string
    prepare: string
    preparing: string
  }
}

/**
 * Displays policy header with status and actions.
 * 
 * Shows policy name, version, status badge, last updated date,
 * and prepare button.
 *
 * @param name - Policy name
 * @param version - Policy version number
 * @param status - Policy status (active/inactive)
 * @param lastUpdated - Last update timestamp
 * @param onPrepare - Callback for prepare action
 * @param isPreparing - Whether prepare is in progress
 * @param labels - Localized labels
 */
export function PolicyHeader({
  name,
  version,
  status,
  lastUpdated,
  onPrepare,
  isPreparing,
  labels,
}: PolicyHeaderProps) {
  const badgeVariant = status === POLICY_STATUS.ACTIVE ? 'default' : 'secondary'
  const statusLabel = status === POLICY_STATUS.ACTIVE ? labels.active : labels.inactive
  const date = new Date(lastUpdated).toLocaleDateString('uk-UA')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              {name}
              <Badge variant="outline">v{version}</Badge>
              <Badge variant={badgeVariant}>{statusLabel}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {labels.lastUpdated}: {date}
            </p>
          </div>
          <Button onClick={onPrepare} disabled={isPreparing}>
            {isPreparing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {labels.preparing}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {labels.prepare}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}

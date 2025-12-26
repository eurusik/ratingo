"use client"

import { Card, CardHeader, CardTitle } from '@/shared/ui/card'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Loader2, Play, Pencil } from 'lucide-react'
import { POLICY_STATUS } from '@/modules/admin/types'

export interface PolicyHeaderLabels {
  active: string
  inactive: string
  lastUpdated: string
  prepare: string
  preparing: string
  edit?: string
}

interface PolicyHeaderProps {
  name: string
  version: string
  status: string
  lastUpdated: Date | string
  onPrepare: () => void
  onEdit?: () => void
  isPreparing: boolean
  isEditing?: boolean
  labels: PolicyHeaderLabels
}

/**
 * Displays policy header with status and actions.
 * 
 * Shows policy name, version, status badge, last updated date,
 * and prepare/edit buttons.
 *
 * @param name - Policy name
 * @param version - Policy version number
 * @param status - Policy status (active/inactive)
 * @param lastUpdated - Last update timestamp
 * @param onPrepare - Callback for prepare action
 * @param onEdit - Callback for edit action
 * @param isPreparing - Whether prepare is in progress
 * @param isEditing - Whether currently in edit mode
 * @param labels - Localized labels
 */
export function PolicyHeader({
  name,
  version,
  status,
  lastUpdated,
  onPrepare,
  onEdit,
  isPreparing,
  isEditing = false,
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
          <div className="flex gap-2">
            {onEdit && !isEditing && (
              <Button variant="outline" onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                {labels.edit ?? 'Edit'}
              </Button>
            )}
            <Button onClick={onPrepare} disabled={isPreparing || isEditing}>
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
        </div>
      </CardHeader>
    </Card>
  )
}

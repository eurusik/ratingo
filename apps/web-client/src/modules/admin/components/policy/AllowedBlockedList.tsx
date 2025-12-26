"use client"

import { Badge } from '@/shared/ui/badge'

interface AllowedBlockedListProps {
  allowed: string[]
  blocked: string[]
  labels: { 
    allowed: string
    blocked: string
    othersExcluded?: string
    excludedFromCatalog?: string
  }
}

/**
 * Displays allowed/blocked items with color-coded badges.
 * 
 * Shows two sections: allowed items (green) and blocked/excluded items (red).
 * When blocked is empty but allowed has items, shows "Others excluded" message.
 *
 * @param allowed - Array of allowed item codes
 * @param blocked - Array of blocked item codes
 * @param labels - Localized labels for sections
 */
export function AllowedBlockedList({ allowed, blocked, labels }: AllowedBlockedListProps) {
  const hasWhitelist = allowed.length > 0
  const hasExplicitBlocked = blocked.length > 0

  return (
    <>
      <div>
        <h4 className="text-sm font-medium text-green-600 mb-1">
          {labels.allowed} ({allowed.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {allowed.map((code) => (
            <Badge key={code} variant="outline" className="text-xs">
              {code}
            </Badge>
          ))}
        </div>
      </div>
      <div>
        {hasExplicitBlocked ? (
          <>
            <h4 className="text-sm font-medium text-red-600 mb-1">
              {labels.blocked} ({blocked.length})
            </h4>
            <div className="flex flex-wrap gap-1">
              {blocked.map((code) => (
                <Badge key={code} variant="destructive" className="text-xs">
                  {code}
                </Badge>
              ))}
            </div>
          </>
        ) : hasWhitelist ? (
          <>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              {labels.othersExcluded ?? 'Others'}
            </h4>
            <span className="text-sm text-muted-foreground">
              {labels.excludedFromCatalog ?? 'Excluded from catalog'}
            </span>
          </>
        ) : (
          <>
            <h4 className="text-sm font-medium text-red-600 mb-1">
              {labels.blocked} (0)
            </h4>
            <span className="text-sm text-muted-foreground">—</span>
          </>
        )}
      </div>
    </>
  )
}

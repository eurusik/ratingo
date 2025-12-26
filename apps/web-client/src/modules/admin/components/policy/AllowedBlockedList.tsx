"use client"

import { Badge } from '@/shared/ui/badge'

interface AllowedBlockedListProps {
  allowed: string[]
  blocked: string[]
  labels: { allowed: string; blocked: string }
}

/**
 * Displays allowed/blocked items with color-coded badges.
 * 
 * Shows two sections: allowed items (green) and blocked items (red).
 * Empty blocked list displays placeholder.
 *
 * @param allowed - Array of allowed item codes
 * @param blocked - Array of blocked item codes
 * @param labels - Localized labels for sections
 */
export function AllowedBlockedList({ allowed, blocked, labels }: AllowedBlockedListProps) {
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
        <h4 className="text-sm font-medium text-red-600 mb-1">
          {labels.blocked} ({blocked.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {blocked.length > 0 ? (
            blocked.map((code) => (
              <Badge key={code} variant="destructive" className="text-xs">
                {code}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>
    </>
  )
}

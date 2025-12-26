"use client"

import { Badge } from '@/shared/ui/badge'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive'

interface BadgeListProps {
  items: string[]
  variant?: BadgeVariant
  emptyText?: string
}

/**
 * List of badges with empty state
 */
export function BadgeList({ items, variant = 'secondary', emptyText = '—' }: BadgeListProps) {
  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyText}</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge key={item} variant={variant} className="text-xs">
          {item}
        </Badge>
      ))}
    </div>
  )
}

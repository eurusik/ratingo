"use client"

import type { DiffReportDto } from '@/core/api/admin'

type DiffSample = DiffReportDto['topRegressions'][number]

interface DiffItemListProps {
  items: DiffSample[]
  variant: 'regression' | 'improvement'
  labels: {
    mediaId: string
    statusChange: string
  }
}

export function DiffItemList({ items, variant, labels }: DiffItemListProps) {
  if (items.length === 0) return null

  const bgClass = variant === 'regression' 
    ? 'bg-red-50 dark:bg-red-950/20' 
    : 'bg-green-50 dark:bg-green-950/20'

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className={`p-3 border rounded-lg ${bgClass}`}>
          <div className="font-medium">{item.title}</div>
          <div className="text-sm text-muted-foreground">
            {labels.mediaId}: {item.mediaItemId}
          </div>
          <div className="text-sm">
            {labels.statusChange}: {item.reason}
          </div>
        </div>
      ))}
    </div>
  )
}

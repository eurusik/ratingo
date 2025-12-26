"use client"

import { Card, CardHeader, CardTitle } from '@/shared/ui/card'
import { Badge } from '@/shared/ui/badge'
import { FileEdit } from 'lucide-react'

interface DraftHeaderProps {
  baseVersion?: string
  labels: {
    title: string
    basedOn: string
    fromScratch: string
  }
}

/**
 * Header for draft policy page.
 * 
 * Shows draft badge and base version info.
 */
export function DraftHeader({
  baseVersion,
  labels,
}: DraftHeaderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <FileEdit className="h-5 w-5" />
          {labels.title}
          <Badge variant="secondary">
            {baseVersion 
              ? `${labels.basedOn} v${baseVersion}`
              : labels.fromScratch
            }
          </Badge>
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

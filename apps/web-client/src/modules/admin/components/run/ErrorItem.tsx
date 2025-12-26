"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { ChevronDown, ChevronRight } from 'lucide-react'

interface ErrorItemProps {
  error: {
    mediaItemId: string
    error: string
    stack?: string
    timestamp: string
  }
  isExpanded: boolean
  onToggle: () => void
  labels: {
    mediaId: string
    stackTrace: string
  }
}

export function ErrorItem({ error, isExpanded, onToggle, labels }: ErrorItemProps) {
  return (
    <CollapsiblePrimitive.Root open={isExpanded}>
      <CollapsiblePrimitive.Trigger
        className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <div className="text-left">
            <div className="font-medium">{error.error}</div>
            <div className="text-sm text-muted-foreground">
              {labels.mediaId}: {error.mediaItemId}
            </div>
          </div>
        </div>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content className="px-4 pb-4">
        <div className="space-y-4 mt-4">
          <div className="text-sm">
            <div><strong>{labels.mediaId}:</strong> {error.mediaItemId}</div>
            <div><strong>Timestamp:</strong> {error.timestamp}</div>
          </div>
          {error.stack && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{labels.stackTrace}</CardTitle>
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
  )
}

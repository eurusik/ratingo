import React from 'react'
import { Card, CardContent } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { Badge } from '@/shared/ui/badge'
import { ProgressStats } from '../types'

interface ProgressWithStatsProps {
  stats: ProgressStats
  className?: string
}

/**
 * ProgressWithStats component combining Progress with Badge counters
 * Requirements: 3.4
 */
export function ProgressWithStats({ 
  stats, 
  className 
}: ProgressWithStatsProps) {
  const { processed, total, eligible, ineligible, pending, errors } = stats
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">
                {processed.toLocaleString()} / {total.toLocaleString()}
              </span>
            </div>
            <Progress value={percentage} className="h-3" />
            <div className="text-center text-sm text-muted-foreground">
              {percentage}% complete
            </div>
          </div>

          {/* Stats Pills */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <span className="font-medium text-green-600">{eligible.toLocaleString()}</span>
              <span className="ml-1 text-muted-foreground">eligible</span>
            </Badge>
            
            <Badge variant="outline" className="px-3 py-1">
              <span className="font-medium text-red-600">{ineligible.toLocaleString()}</span>
              <span className="ml-1 text-muted-foreground">ineligible</span>
            </Badge>
            
            {pending > 0 && (
              <Badge variant="outline" className="px-3 py-1">
                <span className="font-medium text-yellow-600">{pending.toLocaleString()}</span>
                <span className="ml-1 text-muted-foreground">pending</span>
              </Badge>
            )}
            
            {errors > 0 && (
              <Badge variant="destructive" className="px-3 py-1">
                <span className="font-medium">{errors.toLocaleString()}</span>
                <span className="ml-1">errors</span>
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
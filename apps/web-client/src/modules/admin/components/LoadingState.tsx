import React from 'react'
import { Card, CardContent } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { Skeleton } from '@/shared/ui/skeleton'
import { Loader2 } from 'lucide-react'
import { LoadingStateProps } from '../types'

/**
 * LoadingState component with skeleton, spinner, and progress variants
 * Requirements: 9.7
 */
export function LoadingState({ 
  type, 
  message 
}: LoadingStateProps) {
  
  // Skeleton variant - for initial page/section loading
  if (type === 'skeleton') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          {message && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Progress variant - for operations with known progress
  if (type === 'progress') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="w-full max-w-md space-y-4">
            <Progress value={undefined} className="w-full" />
            {message && (
              <p className="text-center text-sm text-muted-foreground">
                {message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Spinner variant - for quick loading states
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      {message && (
        <p className="text-sm text-muted-foreground text-center">
          {message}
        </p>
      )}
    </div>
  )
}
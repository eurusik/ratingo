import React from 'react'
import { Card, CardContent } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { ErrorStateProps } from '../types'

/**
 * ErrorState component for displaying error states with retry functionality
 * Supports different variants: page, section, inline
 * Requirements: Error Handling section
 */
export function ErrorState({ 
  error, 
  retry, 
  fallback, 
  variant = 'section' 
}: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error.message

  if (fallback) {
    return <>{fallback}</>
  }

  // Inline variant - minimal error display
  if (variant === 'inline') {
    return (
      <Alert variant="destructive" className="border-destructive/50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{errorMessage}</span>
          {retry && (
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
              className="ml-2 h-6 px-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // Section variant - error in a card
  if (variant === 'section') {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mb-4" />
          
          <h3 className="text-lg font-semibold mb-2 text-destructive">
            Something went wrong
          </h3>
          
          <p className="text-muted-foreground mb-6 max-w-md">
            {errorMessage}
          </p>
          
          {retry && (
            <Button onClick={retry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Page variant - full page error
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <AlertTriangle className="h-12 w-12 text-destructive mb-6" />
      
      <h1 className="text-2xl font-bold mb-2 text-destructive">
        Oops! Something went wrong
      </h1>
      
      <p className="text-muted-foreground mb-8 max-w-md">
        {errorMessage}
      </p>
      
      {retry && (
        <Button onClick={retry} size="lg">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      )}
    </div>
  )
}
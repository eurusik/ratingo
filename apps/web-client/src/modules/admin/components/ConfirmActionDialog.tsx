"use client"

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/shared/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'

import { ConfirmActionDialogProps } from '../types'

function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  requireTyping = false,
  onConfirm,
  variant = 'default',
}: ConfirmActionDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [typedText, setTypedText] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setIsLoading(false)
      setTypedText('')
      setError(null)
    }
  }, [open])

  const handleConfirm = async () => {
    if (requireTyping && typedText !== confirmText) {
      setError(`Please type "${confirmText}" to confirm`)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (!isLoading) {
      onOpenChange(false)
    }
  }

  const isConfirmDisabled = isLoading || (requireTyping && typedText !== confirmText)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {requireTyping && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="confirmation">
                Type <span className="font-mono font-semibold">{confirmText}</span> to confirm:
              </Label>
              <Input
                id="confirmation"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={confirmText}
                disabled={isLoading}
                className={cn(
                  error && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
        )}

        {error && !requireTyping && (
          <div className="py-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            className={cn(
              isLoading && 'cursor-not-allowed'
            )}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmActionDialog }
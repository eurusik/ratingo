"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from '@/shared/i18n'

interface CancelConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  runId: string
  policyName: string
  isLoading?: boolean
}

export function CancelConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  runId,
  policyName,
  isLoading = false,
}: CancelConfirmDialogProps) {
  const { dict } = useTranslation()
  
  const handleConfirm = async () => {
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      // Error handled by parent component
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {dict.admin.runDetail.confirmCancel.title}
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <p>
              {dict.admin.runDetail.confirmCancel.description
                .replace('{policyName}', policyName)
                .replace('{runId}', runId)}
            </p>
            <p className="text-muted-foreground">
              {dict.admin.runDetail.confirmCancel.warning}
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            {dict.admin.runDetail.confirmCancel.keepRunning}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {dict.admin.runDetail.confirmCancel.cancelling}
              </>
            ) : (
              dict.admin.runDetail.confirmCancel.confirm
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

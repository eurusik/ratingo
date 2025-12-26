"use client"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from '@/shared/i18n'

interface PromoteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  runId: string
  policyName: string
  isLoading?: boolean
}

export function PromoteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  runId,
  policyName,
  isLoading = false,
}: PromoteConfirmDialogProps) {
  const { dict } = useTranslation()
  const [confirmText, setConfirmText] = useState('')
  const isConfirmValid = confirmText === 'PROMOTE'

  const handleConfirm = async () => {
    if (!isConfirmValid) return
    
    try {
      await onConfirm()
      setConfirmText('')
      onOpenChange(false)
    } catch (error) {
      // Error handled by parent component
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      setConfirmText('')
      onOpenChange(newOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {dict.admin.runDetail.confirmPromote.title}
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <p>
              {dict.admin.runDetail.confirmPromote.description
                .replace('{policyName}', policyName)
                .replace('{runId}', runId)}
            </p>
            <p className="text-destructive font-medium">
              {dict.admin.runDetail.confirmPromote.warning}
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-text">
              {dict.admin.runDetail.confirmPromote.typeToConfirm}
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={dict.admin.runDetail.confirmPromote.placeholder}
              disabled={isLoading}
              autoComplete="off"
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            {dict.admin.runDetail.confirmPromote.cancel}
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={!isConfirmValid || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {dict.admin.runDetail.confirmPromote.promoting}
              </>
            ) : (
              dict.admin.runDetail.confirmPromote.confirm
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

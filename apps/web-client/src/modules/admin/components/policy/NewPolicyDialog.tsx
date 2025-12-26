"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { FileText, FilePlus } from 'lucide-react'

interface NewPolicyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateFromActive: () => void
  onCreateFromScratch: () => void
  activeVersion?: string
  labels: {
    title: string
    description: string
    fromActive: string
    fromActiveHint: string
    fromScratch: string
    recommended: string
  }
}

/**
 * Dialog for choosing how to create a new policy.
 * 
 * Offers two options: create from active policy or from scratch.
 */
export function NewPolicyDialog({
  open,
  onOpenChange,
  onCreateFromActive,
  onCreateFromScratch,
  activeVersion,
  labels,
}: NewPolicyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>
            {labels.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 pt-4">
          <Button
            variant="outline"
            className="h-auto p-4 justify-start"
            onClick={onCreateFromActive}
          >
            <FileText className="h-5 w-5 mr-3 shrink-0" />
            <div className="text-left">
              <div className="font-medium flex items-center gap-2">
                {labels.fromActive}
                {activeVersion && (
                  <span className="text-xs text-muted-foreground">v{activeVersion}</span>
                )}
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {labels.recommended}
                </span>
              </div>
              <div className="text-sm text-muted-foreground font-normal">
                {labels.fromActiveHint}
              </div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="h-auto p-4 justify-start"
            onClick={onCreateFromScratch}
          >
            <FilePlus className="h-5 w-5 mr-3 shrink-0" />
            <div className="text-left">
              <div className="font-medium">{labels.fromScratch}</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client';

import { useState } from 'react';
import { Flag, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Textarea,
  Label,
  RadioGroup,
  RadioGroupItem,
} from '@/shared/ui';

export const REPORT_REASONS = {
  spam: 'spam',
  harassment: 'harassment',
  hate_speech: 'hate_speech',
  misinformation: 'misinformation',
  spoiler_unmarked: 'spoiler_unmarked',
  other: 'other',
} as const;

export type ReportReason = (typeof REPORT_REASONS)[keyof typeof REPORT_REASONS];

interface ReviewReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: ReportReason, details?: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function ReviewReportDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting: externalIsSubmitting,
}: ReviewReportDialogProps) {
  const { dict } = useTranslation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  // Use external isSubmitting if provided (parent controls state)
  const isSubmitting = externalIsSubmitting ?? false;

  const handleSubmit = async () => {
    if (!reason) return;

    // Parent handles toast and dialog closing
    await onSubmit(reason, details.trim() || undefined);
  };

  const handleClose = () => {
    setReason(null);
    setDetails('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-cinema-card border-cinema-borderSoft">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Flag className="w-5 h-5 text-red-500" />
            {dict.reviews.report.title}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {dict.reviews.report.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Reason selection */}
          <div className="space-y-3">
            <Label className="text-sm text-zinc-300">{dict.reviews.report.reason}</Label>
            <RadioGroup
              value={reason ?? ''}
              onValueChange={(value) => setReason(value as ReportReason)}
              className="space-y-2"
            >
              {Object.values(REPORT_REASONS).map((reasonValue) => (
                <div
                  key={reasonValue}
                  className={cn(
                    'flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer',
                    reason === reasonValue
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-cinema-borderSoft hover:border-zinc-700',
                  )}
                  onClick={() => setReason(reasonValue)}
                >
                  <RadioGroupItem
                    value={reasonValue}
                    id={reasonValue}
                    className="border-zinc-600 text-red-500"
                  />
                  <Label
                    htmlFor={reasonValue}
                    className="text-sm text-zinc-300 cursor-pointer flex-1"
                  >
                    {dict.reviews.report.reasons[reasonValue]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Details textarea */}
          <div className="space-y-2">
            <Label htmlFor="details" className="text-sm text-zinc-300">
              {dict.reviews.report.details}
              <span className="text-zinc-500 ml-1">({dict.reviews.report.optional})</span>
            </Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={dict.reviews.report.detailsPlaceholder}
              className={cn(
                'min-h-[80px] bg-cinema-elevated/50 border resize-none text-sm',
                'text-zinc-200 placeholder-zinc-500 border-zinc-700',
              )}
              maxLength={500}
              disabled={isSubmitting}
            />
            <div className="flex justify-end">
              <span className="text-xs text-zinc-500">{500 - details.length}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-500/90">{dict.reviews.report.warning}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-zinc-400 hover:text-zinc-200"
          >
            {dict.reviews.report.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || isSubmitting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting ? dict.reviews.report.submitting : dict.reviews.report.submit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

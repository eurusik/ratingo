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

  const showDetailsField = reason === REPORT_REASONS.other;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 gap-0 bg-cinema-card border-cinema-borderSoft">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-cinema-text-primary">
            <Flag className="w-5 h-5 text-red-500" />
            {dict.reviews.report.title}
          </DialogTitle>
          <DialogDescription className="text-cinema-text-muted">
            {dict.reviews.report.description}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          {/* Reason selection */}
          <div className="space-y-3">
            <Label className="text-sm text-cinema-text-secondary">{dict.reviews.report.reason}</Label>
            <RadioGroup
              value={reason ?? ''}
              onValueChange={(value) => setReason(value as ReportReason)}
              className="space-y-2"
            >
              {Object.values(REPORT_REASONS).map((reasonValue) => (
                <div
                  key={reasonValue}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer',
                    reason === reasonValue
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-cinema-borderSoft hover:border-cinema-border',
                  )}
                  onClick={() => setReason(reasonValue)}
                >
                  <RadioGroupItem
                    value={reasonValue}
                    id={reasonValue}
                    className="border-cinema-border text-red-500"
                  />
                  <Label
                    htmlFor={reasonValue}
                    className="text-sm text-cinema-text-secondary cursor-pointer flex-1"
                  >
                    {dict.reviews.report.reasons[reasonValue]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Details textarea - only for "other" */}
          {showDetailsField && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label htmlFor="details" className="text-sm text-cinema-text-secondary">
                {dict.reviews.report.details}
              </Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={dict.reviews.report.detailsPlaceholder}
                className={cn(
                  'min-h-[80px] bg-cinema-elevated/50 border resize-none text-sm',
                  'text-cinema-text-primary placeholder:text-cinema-text-disabled border-cinema-borderSoft',
                )}
                maxLength={500}
                disabled={isSubmitting}
              />
              <div className="flex justify-end">
                <span className="text-xs text-cinema-text-muted">{500 - details.length}</span>
              </div>
            </div>
          )}

          {/* Inline warning */}
          <p className="text-xs text-cinema-text-disabled flex items-center gap-1.5 pt-2 pb-4">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0" />
            {dict.reviews.report.warning}
          </p>
        </div>

        {/* Sticky footer - clean */}
        <div className="border-t border-cinema-borderSoft px-6 py-4 bg-cinema-card">
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-cinema-text-muted hover:text-cinema-text-primary"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

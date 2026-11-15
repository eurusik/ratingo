'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button, Form, Input, Label, Radio, RadioGroup, TextField } from '@heroui/react';
import type { ReportReason, Review } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { ResponsiveDialog } from '@/shared/ui';
import { useLastShown } from '../lib/use-last-shown';
import { REPORT_REASONS, useReportReview } from '../model/use-report-review';

const MAX_DETAILS_LENGTH = 500;

function isReportReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((reason) => reason === value);
}

function ReportForm({ review, onDone }: { review: Review; onDone: () => void }) {
  const { dict } = useTranslation();
  const copy = dict.reviews.report;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [isReasonMissing, setIsReasonMissing] = useState(false);
  const reasonErrorId = useId();
  const report = useReportReview(onDone);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason) {
      setIsReasonMissing(true);
      return;
    }
    if (report.isPending) return;
    const extra = reason === 'other' ? details.trim() : '';
    report.mutate({ reviewId: review.id, reason, details: extra || undefined });
  };

  return (
    <Form onSubmit={submit} className="flex flex-col gap-3">
      <RadioGroup
        aria-label={copy.title}
        name="reason"
        value={reason}
        isInvalid={isReasonMissing}
        aria-describedby={isReasonMissing ? reasonErrorId : undefined}
        onChange={(value) => {
          if (!isReportReason(value)) return;
          report.reset();
          setReason(value);
          setIsReasonMissing(false);
        }}
        className="gap-0 overflow-hidden rounded-2xl bg-surface"
      >
        {REPORT_REASONS.map((value) => (
          <Radio key={value} value={value} className="border-t border-separator first:border-t-0">
            <Radio.Content className="min-h-12.5 w-full flex-row-reverse justify-between px-3.5 text-[15px]">
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              {copy.reasons[value]}
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>
      {reason === 'other' ? (
        <TextField
          name="details"
          value={details}
          onChange={setDetails}
          maxLength={MAX_DETAILS_LENGTH}
          fullWidth
        >
          <Label className="sr-only">{copy.detailsLabel}</Label>
          <Input
            variant="secondary"
            autoComplete="off"
            autoFocus
            placeholder={copy.detailsPlaceholder}
            className="min-h-12 text-base"
          />
        </TextField>
      ) : null}
      {isReasonMissing ? (
        <p id={reasonErrorId} role="alert" className="text-sm text-danger">
          {copy.pickReason}
        </p>
      ) : null}
      {report.isError ? (
        <p role="alert" className="text-sm text-danger">
          {copy.failed}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="danger"
        size="lg"
        fullWidth
        isPending={report.isPending}
        className="min-h-13 rounded-full font-bold"
      >
        {copy.submit}
      </Button>
    </Form>
  );
}

interface ReportDialogProps {
  review: Review | null;
  onClose: () => void;
}

export function ReportDialog({ review, onClose }: ReportDialogProps) {
  const { dict } = useTranslation();
  const shown = useLastShown(review);

  return (
    <ResponsiveDialog
      isOpen={review !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={dict.reviews.report.title}
    >
      {shown ? <ReportForm key={shown.id} review={shown} onDone={onClose} /> : null}
    </ResponsiveDialog>
  );
}

'use client';

import { useTranslation } from '@/shared/i18n';
import { useClientNow } from '@/shared/lib';
import { formatFullDate, formatRelativeTime } from '../lib/review-time-format';

export function ReviewTime({ date }: { date: string }) {
  const { dict, locale } = useTranslation();
  const now = useClientNow();

  return (
    <time dateTime={date} title={formatFullDate(date, locale)}>
      {formatRelativeTime(date, now, locale, dict.reviews.card.justNow)}
    </time>
  );
}

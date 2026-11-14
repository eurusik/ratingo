'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/shared/i18n';
import { formatCompactCount } from '@/shared/lib';

export const REVIEWS_HEADING_ID = 'reviews-heading';

export function focusReviewsHeading(): void {
  requestAnimationFrame(() => document.getElementById(REVIEWS_HEADING_ID)?.focus());
}

interface ReviewsHeadingProps {
  total: number;
  level?: 'h1' | 'h2';
  trailing?: ReactNode;
}

export function ReviewsHeading({ total, level = 'h2', trailing }: ReviewsHeadingProps) {
  const { dict, locale } = useTranslation();
  const Heading = level;

  return (
    <div className="flex min-h-tap items-center gap-3">
      <Heading
        id={REVIEWS_HEADING_ID}
        tabIndex={-1}
        className={`flex-1 font-extrabold tracking-tight outline-none ${level === 'h1' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}
      >
        {dict.reviews.title}
        {total > 0 ? (
          <span className="ms-2 font-semibold text-muted tabular-nums">
            {formatCompactCount(locale, total)}
          </span>
        ) : null}
      </Heading>
      {trailing}
    </div>
  );
}

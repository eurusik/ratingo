'use client';

import { ChevronLeft } from 'lucide-react';
import { BackLink } from '@/shared/ui';
import { interpolate, useTranslation } from '@/shared/i18n';

interface ReviewsTopBarProps {
  title: string;
  backHref: string;
}

export function ReviewsTopBar({ title, backHref }: ReviewsTopBarProps) {
  const { dict } = useTranslation();

  return (
    <div
      data-top-bar
      data-glass-bar
      className="sticky top-0 z-30 -mt-(--page-top) border-b border-separator bg-background/85 pt-safe-top pr-safe-right pl-safe-left backdrop-blur-xl md:hidden"
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <BackLink
          fallbackHref={backHref}
          aria-label={interpolate(dict.reviews.backToTitle, { title })}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </BackLink>
        <span className="min-w-0 flex-1 truncate text-center text-base font-bold">{title}</span>
        <span aria-hidden className="size-11 shrink-0" />
      </div>
    </div>
  );
}

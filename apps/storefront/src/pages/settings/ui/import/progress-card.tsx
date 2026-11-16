'use client';

import { useId, type ReactNode } from 'react';
import { ProgressBar } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';

interface ProgressCardProps {
  title: string;
  done: number;
  total: number;
  text: string;
  actions: ReactNode;
  isHighlighted?: boolean;
}

export function ProgressCard({
  title,
  done,
  total,
  text,
  actions,
  isHighlighted = false,
}: ProgressCardProps) {
  const { dict } = useTranslation();
  const titleId = useId();
  const progressText = interpolate(dict.settings.import.pending.progress, { done, total });

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 md:px-5 md:py-4.5',
        isHighlighted && 'border border-accent/40',
      )}
    >
      <div className="flex items-baseline gap-2">
        <h2 id={titleId} className="min-w-0 flex-1 text-base font-bold">
          {title}
        </h2>
        <span aria-hidden className="text-[13px] text-muted tabular-nums md:text-sm">
          {progressText}
        </span>
      </div>
      <ProgressBar
        aria-labelledby={titleId}
        value={done}
        maxValue={Math.max(total, 1)}
        valueLabel={progressText}
        size="sm"
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <p className="text-[13px] leading-snug text-muted md:text-sm">{text}</p>
      <div className="flex gap-2">{actions}</div>
    </section>
  );
}

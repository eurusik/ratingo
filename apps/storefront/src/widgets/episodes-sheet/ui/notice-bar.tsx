'use client';

import { Button } from '@heroui/react';
import { Check } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import type { EpisodesTracker } from '../model/use-episodes-tracker';

export function NoticeBar({
  tracker,
  className,
}: {
  tracker: EpisodesTracker;
  className?: string;
}) {
  const { dict } = useTranslation();
  const { notice } = tracker;

  return (
    <div
      role="status"
      className={className}
      onPointerEnter={() => tracker.holdNotice(true)}
      onPointerLeave={() => tracker.holdNotice(false)}
      onFocus={() => tracker.holdNotice(true)}
      onBlur={() => tracker.holdNotice(false)}
    >
      {notice ? (
        <div
          key={notice.id}
          className="flex min-h-14 items-center gap-1 rounded-2xl bg-surface-tertiary ps-4 pe-1.5 text-surface-tertiary-foreground shadow-overlay"
        >
          <Check aria-hidden className="me-1 size-5 shrink-0 text-success" strokeWidth={2.6} />
          <span className="line-clamp-2 min-w-0 flex-1 py-1 text-sm font-semibold">
            {notice.message}
          </span>
          {notice.narrow ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={tracker.narrowNotice}
              className="min-h-tap shrink-0 px-2.5 font-bold underline"
            >
              {notice.narrow.label}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onPress={tracker.undoNotice}
            className="min-h-tap shrink-0 px-2.5 font-bold text-accent"
          >
            {dict.episodes.notice.undo}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

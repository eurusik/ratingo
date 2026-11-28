'use client';

import { useState } from 'react';
import { Skeleton } from '@heroui/react';
import { Languages } from 'lucide-react';
import type { EpisodeOverviewState } from '@/entities/episode';
import { useTranslation } from '@/shared/i18n';
import { SpoilerCover } from '@/shared/ui';

const OVERVIEW_TEXT = 'text-[15px] leading-normal break-words text-foreground/90 md:max-w-[72ch]';

interface EpisodeOverviewBlockProps {
  state: EpisodeOverviewState;
  spoilerHint?: string;
}

function OverviewSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-11/12 rounded-md" />
      <Skeleton className="h-4 w-2/3 rounded-md" />
    </div>
  );
}

export function EpisodeOverviewBlock({ state, spoilerHint }: EpisodeOverviewBlockProps) {
  const { dict } = useTranslation();
  const [isRevealed, setIsRevealed] = useState(false);
  const { overview, isLoading, isFailed } = state;

  if (isFailed) return <p className="text-[13px] text-muted">{dict.episodes.detail.loadFailed}</p>;
  if (isLoading) return <OverviewSkeleton />;
  if (!overview) return null;

  if (spoilerHint && !isRevealed) {
    return (
      <div className="flex flex-col gap-2">
        <SpoilerCover
          text={overview.overview}
          revealLabel={dict.episodes.detail.spoiler}
          onReveal={() => setIsRevealed(true)}
        />
        <p className="text-[13px] text-muted">{spoilerHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {overview.isUkrainian ? null : (
        <p className="flex items-center gap-1.5 text-[13px] text-muted">
          <Languages aria-hidden className="size-4 shrink-0" />
          {dict.episodes.detail.notUkrainian}
        </p>
      )}
      <p lang={overview.isUkrainian ? undefined : 'en'} className={OVERVIEW_TEXT}>
        {overview.overview}
      </p>
    </div>
  );
}

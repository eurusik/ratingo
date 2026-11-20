'use client';

import { formatReleaseBadge, formatReleaseDate, MediaPoster } from '@/entities/media';
import { SaveButton } from '@/features/save-to-library';
import type { MediaType } from '@/shared/api';
import { mediaRoute } from '@/shared/config';
import { SHARED_ART_SOURCE } from '@/shared/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ForwardLink } from '@/shared/ui';

export interface ReleaseNote {
  text: string;
  tone: 'muted' | 'accent';
}

const NOTE_TONE_CLASS: Record<ReleaseNote['tone'], string> = {
  muted: 'text-muted',
  accent: 'text-accent',
};

export interface ReleaseTileMedia {
  mediaItemId: string;
  title: string;
  slug: string;
  type: MediaType;
}

interface ReleaseTileProps {
  media: ReleaseTileMedia;
  posterUrl?: string;
  date: string;
  dateLabel: string;
  note?: ReleaseNote;
  onOpen: () => void;
}

export function ReleaseTile({ media, posterUrl, date, dateLabel, note, onOpen }: ReleaseTileProps) {
  const { locale } = useTranslation();

  return (
    <div className="relative w-24 md:w-full">
      <ForwardLink
        href={mediaRoute(media.type, media.slug)}
        onClick={onOpen}
        className="flex flex-col gap-1.5 text-foreground no-underline md:gap-2"
      >
        <span {...SHARED_ART_SOURCE} className="relative">
          <MediaPoster type={media.type} posterUrl={posterUrl} size="rank" />
          <time
            aria-hidden
            dateTime={date.slice(0, 10)}
            className="absolute start-1.5 bottom-1.5 rounded-lg poster-glass px-1.5 py-0.5 text-xs font-extrabold tabular-nums"
          >
            {formatReleaseBadge(locale, date)}
          </time>
        </span>
        <span className="line-clamp-2 min-h-[2lh] text-[13px] leading-tight font-semibold break-words md:text-sm">
          {media.title}
        </span>
        <span className="sr-only">
          {interpolate(dateLabel, { date: formatReleaseDate(locale, date) })}
        </span>
        {note ? (
          <span className={`truncate text-xs ${NOTE_TONE_CLASS[note.tone]}`}>{note.text}</span>
        ) : null}
      </ForwardLink>
      <div className="absolute end-1 top-1 z-10">
        <SaveButton media={media} tone="overlay" />
      </div>
    </div>
  );
}

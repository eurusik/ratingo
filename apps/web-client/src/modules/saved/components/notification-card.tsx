/**
 * Single notification card for the notifications page.
 * Displays trigger type, media info, context, and action buttons.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import type { components } from '@ratingo/api-contract';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';

type NotificationItem = components['schemas']['NotificationItemDto'];

type NotificationCardProps = Omit<NotificationItem, 'id'>;

const TRIGGER_DOT: Record<string, string> = {
  new_season: 'bg-green-400',
  new_episode: 'bg-blue-400',
  on_streaming: 'bg-purple-400',
  release: 'bg-amber-400',
  status_changed: 'bg-slate-400',
};

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

function getRelativeTimeFormatter(locale: string): Intl.RelativeTimeFormat {
  let rtf = rtfCache.get(locale);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    rtfCache.set(locale, rtf);
  }
  return rtf;
}

function formatRelativeTime(dateString: string, locale: string): string {
  const now = Date.now();
  const diff = now - new Date(dateString).getTime();
  const seconds = Math.floor(diff / 1000);

  const rtf = getRelativeTimeFormatter(locale);

  if (seconds < 60) return rtf.format(-seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');

  return new Date(dateString).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  });
}

export function NotificationCard({
  trigger,
  payload,
  isRead,
  createdAt,
  mediaSummary,
}: NotificationCardProps) {
  const { dict, locale } = useTranslation();

  const triggerLabel =
    {
      release: dict.notifications.events.released,
      new_season: dict.notifications.events.newSeason,
      new_episode: dict.notifications.events.newEpisode,
      on_streaming: dict.notifications.events.onStreaming,
      status_changed: dict.notifications.events.statusChanged,
    }[trigger] ?? trigger;

  const href = (
    mediaSummary.type === 'movie'
      ? `/movies/${mediaSummary.slug}`
      : `/shows/${mediaSummary.slug}`
  ) as Route;

  // Build event context: season/episode key
  const context: string[] = [];
  if (payload?.episodeKey) {
    context.push(payload.episodeKey);
  } else if (payload?.seasonNumber) {
    context.push(
      dict.notifications.context.season.replace('{number}', String(payload.seasonNumber)),
    );
  }

  const airDate = payload?.airDate
    ? new Date(payload.airDate).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
    : null;

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-xl bg-cinema-card/50 border border-cinema-border/10 hover:bg-cinema-elevated/50 hover:border-cinema-border/30 transition-colors cursor-pointer',
        !isRead && 'border-l-2 border-l-blue-500',
        isRead && 'border-l-2 border-l-transparent',
      )}
    >
      {/* Poster */}
      <div className="relative w-16 h-24 rounded-md overflow-hidden bg-cinema-elevated shrink-0">
        {mediaSummary.poster?.small ? (
          <Image
            src={mediaSummary.poster.small}
            alt={mediaSummary.title}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-cinema-text-disabled text-xs">
            —
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col self-stretch">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-cinema-text-primary group-hover:text-white transition-colors truncate">
            {mediaSummary.title}
          </p>
          <span className="text-xs text-cinema-text-muted shrink-0 mt-0.5">
            {formatRelativeTime(createdAt, locale)}
          </span>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-cinema-text-muted mt-1">
          <span
            aria-hidden="true"
            className={cn(
              'w-2 h-2 rounded-full shrink-0',
              TRIGGER_DOT[trigger] ?? 'bg-cinema-text-muted',
            )}
          />
          {[triggerLabel, ...context].join(' · ')}
        </p>

        {airDate && (
          <p className="text-xs text-cinema-text-muted mt-auto">
            {airDate}
          </p>
        )}
      </div>
    </Link>
  );
}

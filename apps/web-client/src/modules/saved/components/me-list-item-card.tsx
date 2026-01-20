/**
 * Card component for watchlist and history items.
 * Clean design: info layer + action layer separated.
 */

'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Image from 'next/image';
import { Play, CheckCircle, XCircle, Pause, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/utils';
import { useTranslation } from '@/shared/i18n';
import type { MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import { USER_MEDIA_STATE } from '@/core/api/me-lists.client';
import { usePauseMedia, useResumeMedia } from '../hooks/use-me-lists';

type UserMediaState = MeUserMediaListItemDto['state'];

interface MeListItemCardProps {
  item: MeUserMediaListItemDto;
}

const stateConfig: Record<
  UserMediaState,
  { icon: typeof Play; label: string; colorClass: string; bgClass: string }
> = {
  watching: {
    icon: Play,
    label: 'watching',
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10',
  },
  completed: {
    icon: CheckCircle,
    label: 'completed',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
  },
  planned: {
    icon: Clock,
    label: 'planned',
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
  },
  dropped: {
    icon: XCircle,
    label: 'dropped',
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
  },
  paused: {
    icon: Pause,
    label: 'paused',
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-500/10',
  },
};

export function MeListItemCard({ item }: MeListItemCardProps) {
  const { dict } = useTranslation();
  const router = useRouter();
  const media = item.mediaSummary;
  const pauseMutation = usePauseMedia();
  const resumeMutation = useResumeMedia();

  if (!media) return null;

  const href = media.type === 'movie' ? `/movies/${media.slug}` : `/shows/${media.slug}`;
  const year = media.releaseDate ? new Date(media.releaseDate).getFullYear() : null;
  const poster = media.poster as Record<string, string> | null;

  const stateInfo = stateConfig[item.state];
  const StateIcon = stateInfo.icon;
  const stateLabel = dict.saved?.states?.[item.state as keyof typeof dict.saved.states] ?? item.state;
  const typeLabel = media.type === 'movie' ? dict.mediaType.movie : dict.mediaType.show;

  const hasProgress = item.progressSummary && media.type === 'show';
  const watched = item.progressSummary?.watched ?? 0;
  const total = item.progressSummary?.total ?? 0;
  const progressPercent = total > 0 ? (watched / total) * 100 : 0;

  const canPause = item.state === USER_MEDIA_STATE.WATCHING;
  const canResume = item.state === USER_MEDIA_STATE.PAUSED;
  const hasAction = canPause || canResume;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on a button
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    router.push(href as Route);
  };

  const handlePause = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    pauseMutation.mutate(item.mediaItemId, {
      onSuccess: () => {
        toast.success(dict.activity?.toast?.paused ?? 'Поставлено на паузу');
      },
      onError: () => {
        toast.error('Помилка');
      },
    });
  };

  const handleResume = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resumeMutation.mutate(item.mediaItemId, {
      onSuccess: () => {
        toast.success(dict.activity?.toast?.resumed ?? 'Продовжено перегляд');
      },
      onError: () => {
        toast.error('Помилка');
      },
    });
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === 'Enter' && !(e.target as HTMLElement).closest('button') && router.push(href as Route)}
      className="group relative flex gap-4 p-4 rounded-xl bg-cinema-card/50 hover:bg-cinema-elevated/50 transition-colors cursor-pointer"
    >
      {/* Poster */}
      <div className="shrink-0">
        <div className="relative w-16 h-24 rounded-lg overflow-hidden bg-cinema-elevated">
          {poster?.small ? (
            <Image src={poster.small} alt={media.title} fill sizes="64px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-cinema-text-disabled text-xs">
              —
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Info layer */}
        <div className="flex-1">
          <h3 className="font-medium text-cinema-text-primary truncate group-hover:text-white transition-colors">
            {media.title}
          </h3>
          <p className="text-sm text-cinema-text-muted mt-0.5">
            {typeLabel}
            {year && ` · ${year}`}
            {` · `}
            <span className={stateInfo.colorClass}>{stateLabel}</span>
          </p>

          {/* Progress bar for shows */}
          {hasProgress && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 bg-cinema-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-cinema-text-muted tabular-nums">
                {watched}/{total}
              </span>
            </div>
          )}
        </div>

        {/* Action layer - only show if there's an action */}
        {hasAction && (
          <div className="flex items-center justify-end mt-3">
            {canPause && (
              <button
                onClick={handlePause}
                disabled={pauseMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cinema-text-secondary hover:text-cinema-text-primary hover:bg-cinema-elevated/50 transition-colors disabled:opacity-50"
              >
                <Pause className="w-3.5 h-3.5" />
                {dict.saved?.actions?.pause ?? 'На паузу'}
              </button>
            )}

            {canResume && (
              <button
                onClick={handleResume}
                disabled={resumeMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {dict.saved?.actions?.resume ?? 'Продовжити'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

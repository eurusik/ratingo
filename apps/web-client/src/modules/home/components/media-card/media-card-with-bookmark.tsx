/**
 * Client wrapper for MediaCardServer with bookmark functionality.
 */

'use client';

import { toast } from 'sonner';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { useSaveStatus, useSaveItem, useUnsaveItem } from '@/core/query';
import { MediaCardServer, type MediaCardServerProps } from './media-card-server';
import { CardBookmark } from './card-cta';
import { CardLayout, cardTitleStyles } from './card-layout';
import { CardPoster } from './card-poster';
import { CardRating } from './card-rating';
import { CardBadge, RankBadge, badgeLabelKeys } from './card-badge';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { formatYear } from '@/shared/utils/format';
import { useTranslation } from '@/shared/i18n';

const DEFAULT_LIST = 'for_later' as const;

interface MediaCardWithBookmarkProps extends MediaCardServerProps {
  /** Verdict messageKey for reasonKey when saving */
  verdictKey?: string | null;
}

export function MediaCardWithBookmark(props: MediaCardWithBookmarkProps) {
  const {
    id,
    slug,
    type,
    title,
    poster,
    stats,
    releaseDate,
    rank,
    badgeKey,
    verdictKey,
  } = props;

  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const openLogin = useAuthModalStore((s) => s.openLogin);

  const { data: saveStatus } = useSaveStatus(id, {
    enabled: isAuthenticated && !!id,
  });

  const { mutate: saveItem, isPending: isSaving } = useSaveItem();
  const { mutate: unsaveItem, isPending: isUnsaving } = useUnsaveItem();

  const isBookmarked = saveStatus?.isForLater ?? false;
  const isMutating = isSaving || isUnsaving;

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      openLogin();
      return;
    }

    if (isMutating) return;

    if (isBookmarked) {
      unsaveItem(
        { mediaItemId: id, list: DEFAULT_LIST, context: 'card' },
        {
          onSuccess: () => toast.success('Видалено зі збережених'),
          onError: () => toast.error('Не вдалося видалити'),
        }
      );
    } else {
      saveItem(
        { 
          mediaItemId: id, 
          list: DEFAULT_LIST, 
          context: 'card',
          reasonKey: verdictKey ?? undefined,
        },
        {
          onSuccess: () => toast.success('Збережено'),
          onError: () => toast.error('Не вдалося зберегти'),
        }
      );
    }
  };

  // Derived values
  const posterUrl = poster?.medium ?? null;
  const rating = stats?.qualityScore ?? null;
  const watchers = stats?.liveWatchers ?? null;
  const href = type === 'movie' ? `/movies/${slug}` : `/shows/${slug}`;

  const posterSlot = (
    <CardPoster src={posterUrl} alt={title} type={type} noPosterText={dict.card.noPoster}>
      {rank != null && rank <= 3 ? (
        <RankBadge rank={rank} />
      ) : badgeKey ? (
        <CardBadge badgeKey={badgeKey} label={dict.card.badge[badgeLabelKeys[badgeKey]]} position="top-right" />
      ) : null}
    </CardPoster>
  );

  const overlaySlot = (
    <CardBookmark 
      isBookmarked={isBookmarked} 
      onClick={handleBookmarkClick} 
    />
  );

  return (
    <CardLayout href={href} as="article" poster={posterSlot} overlay={overlaySlot}>
      <h3 className={cn(cardTitleStyles)}>
        {title}
      </h3>

      <CardRating rating={rating} watchers={watchers} className="mb-2" />

      {releaseDate ? (
        <div className="text-sm text-gray-400 flex items-center gap-1.5 mt-auto">
          <Calendar className="w-4 h-4" />
          <span>{formatYear(releaseDate)}</span>
        </div>
      ) : null}
    </CardLayout>
  );
}

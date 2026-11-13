import type { ReactNode } from 'react';
import { Card } from '@heroui/react';
import { mediaRoute } from '@/shared/config';
import { SHARED_ART_SCOPE, SHARED_ART_SOURCE } from '@/shared/lib';
import { ForwardLink } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import type { TrendingMedia } from '../model/media';
import { MediaBackdrop } from './media-backdrop';
import { EventBadge } from './event-badge';
import { ExternalRatings } from './external-ratings';
import { ProviderLogos } from './provider-logos';
import { VerdictChip } from './verdict-chip';
import { WatchingNowChip } from './watching-now-chip';

interface TrendingCardProps {
  media: TrendingMedia;
  isPriority?: boolean;
  actions?: ReactNode;
  footer?: ReactNode;
}

export function TrendingCard({ media, isPriority = false, actions, footer }: TrendingCardProps) {
  const { dict } = useTranslation();
  const details = [dict.media.type[media.type], media.year].filter(Boolean).join(' · ');

  return (
    <Card
      {...SHARED_ART_SCOPE}
      className="relative w-77.5 gap-0 overflow-hidden rounded-3xl p-0 md:w-full"
    >
      <div {...SHARED_ART_SOURCE} className="relative">
        <MediaBackdrop type={media.type} backdropUrl={media.backdropUrl} isPriority={isPriority} />
        <ExternalRatings
          imdbRating={media.imdbRating}
          criticsPercent={media.criticsPercent}
          className="absolute start-3 top-3"
        />
        {media.watchingNow === undefined ? null : (
          <div className="absolute start-3 bottom-3">
            <WatchingNowChip count={media.watchingNow} />
          </div>
        )}
      </div>
      <Card.Header className="gap-1.5 px-4 pt-3.5 pb-4">
        <div className="flex items-center gap-2.5">
          <Card.Title className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight">
            <ForwardLink
              href={mediaRoute(media.type, media.slug)}
              className="text-foreground no-underline outline-none after:absolute after:inset-0 after:rounded-3xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
            >
              {media.title}
            </ForwardLink>
          </Card.Title>
          {media.verdict ? <VerdictChip verdict={media.verdict} /> : null}
        </div>
        <div className="flex min-h-6 items-center gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Card.Description className="min-w-0 truncate text-sm tabular-nums">
              {details}
            </Card.Description>
            {media.event ? <EventBadge event={media.event} /> : null}
          </div>
          {footer}
          <ProviderLogos providers={media.providers} />
        </div>
      </Card.Header>
      {actions ? <div className="absolute end-3 top-3 z-10">{actions}</div> : null}
    </Card>
  );
}

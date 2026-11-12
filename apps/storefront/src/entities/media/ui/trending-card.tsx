import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, Chip } from '@heroui/react';
import { mediaRoute } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import type { TrendingMedia } from '../model/media';
import { MediaBackdrop } from './media-backdrop';
import { ProviderLogos } from './provider-logos';
import { ScoreChip } from './score-chip';

interface TrendingCardProps {
  media: TrendingMedia;
  actions?: ReactNode;
  footer?: ReactNode;
}

export function TrendingCard({ media, actions, footer }: TrendingCardProps) {
  const { dict } = useTranslation();
  const details = [dict.media.type[media.type], media.year].filter(Boolean).join(' · ');

  return (
    <Card className="relative w-77.5 gap-0 overflow-hidden rounded-3xl p-0">
      <div className="relative">
        <MediaBackdrop type={media.type} backdropUrl={media.backdropUrl} />
        {media.badge ? (
          <Chip
            size="md"
            className="absolute start-3 top-3 bg-black/80 text-xs font-extrabold text-white"
          >
            {dict.media.badge[media.badge]}
          </Chip>
        ) : null}
      </div>
      <Card.Header className="gap-1.5 px-4 pt-3.5 pb-4">
        <div className="flex items-center gap-2.5">
          <Card.Title className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight">
            <Link
              href={mediaRoute(media.type, media.slug)}
              className="text-foreground no-underline after:absolute after:inset-0 after:content-['']"
            >
              {media.title}
            </Link>
          </Card.Title>
          {media.score === undefined ? null : <ScoreChip score={media.score} size="md" />}
        </div>
        <div className="flex min-h-6 items-center gap-2.5">
          <Card.Description className="min-w-0 flex-1 truncate text-sm tabular-nums">
            {details}
          </Card.Description>
          {footer}
          <ProviderLogos providers={media.providers} />
        </div>
      </Card.Header>
      {actions ? <div className="absolute end-3 top-3 z-10">{actions}</div> : null}
    </Card>
  );
}

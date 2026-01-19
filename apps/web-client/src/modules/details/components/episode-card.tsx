'use client';

/**
 * Episode card component for episode list.
 */

import Image from 'next/image';
import { Tv } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';
import { cn, resolveMediaImageUrl, IMAGE_SIZES } from '@/shared/utils';

type EpisodeDto = components['schemas']['EpisodeDto'];

export interface EpisodeCardProps {
  episode: EpisodeDto;
  dict: ReturnType<typeof getDictionary>;
}

/**
 * Formats episode runtime.
 */
function formatRuntime(minutes: number | null | undefined, label: string): string | null {
  if (!minutes) return null;
  return `${minutes} ${label}`;
}

/**
 * Checks if episode is upcoming (air date in future).
 */
function isUpcoming(airDate: string | null | undefined): boolean {
  if (!airDate) return false;
  return new Date(airDate) > new Date();
}

export function EpisodeCard({ episode, dict }: EpisodeCardProps) {
  const upcoming = isUpcoming(episode.airDate);
  const title = episode.title || dict.details.showStatus.noTitle.replace('{number}', String(episode.number));
  const runtime = formatRuntime(episode.runtime, dict.details.showStatus.minutes);

  return (
    <div
      className={cn(
        'flex gap-4 py-3 border-b border-cinema-borderSoft/30 last:border-b-0',
        upcoming && 'opacity-60',
      )}
    >
      {/* Episode thumbnail */}
      <div className="relative flex-shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-cinema-elevated">
        {resolveMediaImageUrl(episode.stillPath, IMAGE_SIZES.W300) ? (
          <Image
            src={resolveMediaImageUrl(episode.stillPath, IMAGE_SIZES.W300)!}
            alt={title}
            fill
            className="object-cover"
            sizes="112px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tv className="w-6 h-6 text-cinema-text-disabled" />
          </div>
        )}
        {upcoming && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-[10px] font-medium text-white uppercase tracking-wider">
              {dict.details.showStatus.upcoming}
            </span>
          </div>
        )}
      </div>

      {/* Episode info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-cinema-text-primary">
            {episode.number}. {title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-cinema-text-muted">
          {episode.airDate && <span>{formatDate(episode.airDate)}</span>}
          {episode.airDate && runtime && <span className="text-cinema-text-disabled">·</span>}
          {runtime && <span>{runtime}</span>}
        </div>
      </div>
    </div>
  );
}
